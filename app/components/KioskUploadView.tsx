'use client';

import { useState } from 'react';
import { Photo, Size } from '../types';
import ImageEditorModal from './ImageEditorModal';
import PhotoGrid from './PhotoGrid';

interface KioskUploadViewProps {
    selectedSize: Size | null;
    onPhotosUploaded: (photos: Photo[]) => void;
    onBack: () => void;
}

type Drive = {
    mountpoints: { path: string }[];
    isRemovable: boolean;
    label: string;
    isSystem: boolean;
};

// States: 'idle' | 'scanning_drives' | 'drive_selection' | 'scanning_files' | 'gallery'
type ViewState = 'idle' | 'scanning_drives' | 'drive_selection' | 'scanning_files' | 'gallery';

const KioskUploadView = ({ selectedSize, onPhotosUploaded, onBack }: KioskUploadViewProps) => {
    const [viewState, setViewState] = useState<ViewState>('idle');
    const [drives, setDrives] = useState<Drive[]>([]);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showNoUSBErr, setShowNoUSBErr] = useState(false);

    const isEvenOnlySize = (sizeId: string) => {
        return sizeId === 'kiosco';
    };

    // --- Step 1: Detect Drives ---
    const handleStartUsb = async () => {
        setViewState('scanning_drives');
        try {
            // @ts-ignore
            const result = await window.electron.getRemovableDrives();
            if (result.success && result.drives) {
                setDrives(result.drives);
                if (result.drives.length === 0) {
                    setViewState('idle');
                    setShowNoUSBErr(true);
                } else {
                    setViewState('drive_selection');
                }
            } else {
                setViewState('idle');
                setShowNoUSBErr(true);
            }
        } catch (e) {
            console.error(e);
            alert("Error detectando unidades.");
            setViewState('idle');
        }
    };

    // --- Step 2: Scan Files ---
    const handleDriveSelect = async (drive: Drive) => {
        const path = drive.mountpoints[0]?.path;
        if (!path) return;

        setViewState('scanning_files');
        try {
            // @ts-ignore
            const result = await window.electron.scanDirectory(path);
            if (result.success && result.files) {
                const scanned: Photo[] = result.files.map((f: any) => ({
                    id: Date.now() + Math.random(),
                    file: { name: f.name, size: 0, type: 'image/jpeg', path: f.path } as unknown as File,
                    preview: f.preview,
                    name: f.name,
                    sourcePath: f.path
                }));

                setPhotos(scanned);
                setSelectedIds(new Set()); // Start clean
                setViewState('gallery');
            } else {
                alert("No se encontraron imágenes en esta unidad.");
                setViewState('drive_selection');
            }
        } catch (e) {
            console.error(e);
            alert("Error leyendo la unidad.");
            setViewState('drive_selection');
        }
    };

    // --- Selection Logic ---
    const toggleSelect = (photo: Photo) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(photo.id)) {
            newSet.delete(photo.id);
        } else {
            newSet.add(photo.id);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        const allIds = photos.map(p => p.id);
        setSelectedIds(new Set(allIds));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    // --- Editor Integration ---
    const handleEditClick = async (photo: Photo) => {
        // Hydrate the file if it's a mock object from Electron
        // Valid real file has size > 0. Mock has size 0/undefined but has a 'path' property we added.
        if (!photo.file.size && (photo.file as any).path) {
            setIsProcessing(true); // Show loading overlay
            try {
                console.log("Hydrating local file:", photo.preview);
                const res = await fetch(photo.preview);
                if (!res.ok) throw new Error("Failed to fetch local file");

                const blob = await res.blob();
                const newFile = new File([blob], photo.name, { type: res.headers.get('content-type') || 'image/jpeg' });

                // Update the photo in state with the REAL file so we don't fetch again
                const hydratedPhoto = { ...photo, file: newFile };
                setPhotos(prev => prev.map(p => p.id === photo.id ? hydratedPhoto : p));

                setEditingPhoto(hydratedPhoto);
            } catch (e) {
                console.error("Error loading image for editing:", e);
                alert("Error al cargar la imagen para edición.");
            } finally {
                setIsProcessing(false);
            }
        } else {
            // Already have a real file (e.g. uploaded or already hydrated)
            setEditingPhoto(photo);
        }
    };

    const handleSaveEdit = (editParams: any, previewUrl: string) => {
        setPhotos(prev => prev.map(p => {
            if (p.id === editingPhoto?.id) {
                const updated = {
                    ...p,
                    preview: previewUrl,
                    editParams: editParams
                };
                // Auto-select after editing if not selected
                if (!selectedIds.has(p.id)) {
                    const newSet = new Set(selectedIds);
                    newSet.add(p.id);
                    setSelectedIds(newSet);
                }
                return updated;
            }
            return p;
        }));
        setEditingPhoto(null);
    };

    // --- Submission ---
    const handleContinue = async () => {
        const selectedCount = selectedIds.size;

        if (selectedCount === 0) {
            alert('Debes seleccionar al menos una foto');
            return;
        }

        if (selectedSize && isEvenOnlySize(selectedSize.id)) {
            if (selectedCount % 2 !== 0) {
                alert('El tamaño 4x6" requiere una cantidad par de fotos (2, 4, 6, etc.)');
                return;
            }
        }

        // Prepare files for backend (convert to Files/Blobs)
        setIsProcessing(true);
        try {
            const finalPhotos = await Promise.all(photos.filter(p => selectedIds.has(p.id)).map(async p => {
                // Ensure we have a real File object. same check as handleEditClick
                if (!p.file.size && (p.file as any).path) {
                    try {
                        const res = await fetch(p.preview);
                        const blob = await res.blob();
                        const newFile = new File([blob], p.name, { type: res.headers.get('content-type') || 'image/jpeg' });
                        return { ...p, file: newFile };
                    } catch (err) {
                        console.error("Failed to hydrate file for upload:", p.name, err);
                        // If fail, we might return p but it will fail backend.
                        // Let's return null and filter? Or throw?
                        throw err;
                    }
                }
                return p;
            }));

            onPhotosUploaded(finalPhotos);
        } catch (e) {
            console.error("Error preparing files", e);
            alert("Error procesando archivos. Intenta nuevamente.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-white px-8 py-12 relative flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => {
                            if (viewState === 'gallery') {
                                setViewState('drive_selection');
                                setSelectedIds(new Set());
                                setPhotos([]);
                            } else if (viewState === 'drive_selection') {
                                setViewState('idle');
                                setDrives([]);
                            } else {
                                onBack();
                            }
                        }}
                        className="flex items-center gap-2 text-[#2D3A52] hover:text-[#D75F1E] transition-colors duration-200 whitespace-nowrap"
                    >
                        <i className="ri-arrow-left-line text-xl"></i>
                        <span className="text-lg font-medium">Volver</span>
                    </button>

                    <div className="text-center flex-1">
                        <h1 className="text-3xl font-bold text-[#2D3A52] mb-2">Modo Kiosco</h1>
                        <p className="text-lg text-[#2D3A52]/70">
                            {viewState === 'idle' && 'Selecciona el método de entrada'}
                            {viewState === 'drive_selection' && 'Selecciona la unidad USB'}
                            {viewState === 'gallery' && 'Selecciona las fotos a imprimir'}
                        </p>
                    </div>
                    <div className="w-24"></div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col">

                    {/* View: IDLE (Source Selection) */}
                    {viewState === 'idle' && (
                        <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto w-full mt-12">
                            <button
                                onClick={handleStartUsb}
                                className="flex flex-col items-center justify-center p-12 bg-[#F0F7FA] border-3 border-[#CEDFE7] hover:border-[#D75F1E] rounded-3xl transition-all group hover:bg-[#D75F1E]/5"
                            >
                                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                                    <i className="ri-usb-line text-5xl text-[#D75F1E]"></i>
                                </div>
                                <span className="text-2xl font-bold text-[#2D3A52]">USB / Memoria</span>
                            </button>

                            <button
                                onClick={() => alert('Próximamente')}
                                className="flex flex-col items-center justify-center p-12 bg-[#F0F7FA] border-3 border-[#CEDFE7] hover:border-[#D75F1E] rounded-3xl transition-all group hover:bg-[#D75F1E]/5 opacity-60"
                            >
                                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                                    <i className="ri-bluetooth-line text-5xl text-[#D75F1E]"></i>
                                </div>
                                <span className="text-2xl font-bold text-[#2D3A52]">Bluetooth</span>
                            </button>
                        </div>
                    )}

                    {/* View: LOADING */}
                    {(viewState === 'scanning_drives' || viewState === 'scanning_files') && (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-20 h-20 border-4 border-[#D75F1E] border-t-transparent rounded-full animate-spin mb-8"></div>
                            <h3 className="text-2xl font-bold text-[#2D3A52]">
                                {viewState === 'scanning_drives' ? 'Buscando dispositivos...' : 'Escaneando fotos...'}
                            </h3>
                        </div>
                    )}

                    {/* View: DRIVE SELECTION */}
                    {viewState === 'drive_selection' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full mt-8">
                            {drives.map((drive, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleDriveSelect(drive)}
                                    className="flex items-center gap-6 p-6 bg-white border-2 border-[#CEDFE7] hover:border-[#D75F1E] rounded-2xl shadow-sm hover:shadow-md transition-all text-left group"
                                >
                                    <div className="w-16 h-16 bg-[#F0F7FA] rounded-xl flex items-center justify-center group-hover:bg-[#D75F1E]/10 transition-colors">
                                        <i className="ri-hard-drive-2-line text-3xl text-[#2D3A52] group-hover:text-[#D75F1E]"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-[#2D3A52]">{drive.label || 'Sin Nombre'}</h3>
                                        <p className="text-sm text-[#2D3A52]/60 font-mono mt-1">{drive.mountpoints[0]?.path}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* View: GALLERY (Photo Selection) */}
                    {viewState === 'gallery' && (
                        <div className="flex flex-col h-full">
                            {/* Toolbar */}
                            <div className="bg-[#F0F7FA] rounded-xl p-4 mb-6 flex items-center justify-between sticky top-0 z-20 shadow-sm border border-[#CEDFE7]">
                                <div className="flex items-center gap-4">
                                    <button onClick={selectAll} className="text-sm font-medium text-[#2D3A52] hover:text-[#D75F1E] flex items-center gap-1">
                                        <i className="ri-checkbox-multiple-line"></i> Seleccionar Todas
                                    </button>
                                    <div className="w-px h-4 bg-[#CEDFE7]"></div>
                                    <button onClick={deselectAll} className="text-sm font-medium text-[#2D3A52] hover:text-[#D75F1E] flex items-center gap-1">
                                        <i className="ri-checkbox-blank-line"></i> Deseleccionar
                                    </button>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-[#2D3A52] text-lg">
                                        {selectedIds.size} <span className="font-normal text-sm text-[#2D3A52]/70">seleccionadas</span>
                                    </span>
                                    <button
                                        onClick={handleContinue}
                                        disabled={selectedIds.size === 0}
                                        className={`
                                    px-6 py-2 rounded-lg font-bold shadow-md transition-all flex items-center gap-2
                                    ${selectedIds.size > 0
                                                ? 'bg-[#D75F1E] text-white hover:bg-[#D75F1E]/90 hover:scale-105'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                                `}
                                    >
                                        Continuar <i className="ri-arrow-right-line"></i>
                                    </button>
                                </div>
                            </div>

                            {/* Grid */}
                            <div className="flex-1 bg-gray-50 rounded-2xl border border-[#CEDFE7] p-4 relative">
                                <PhotoGrid
                                    photos={photos}
                                    selectedIds={selectedIds}
                                    onToggleSelect={toggleSelect}
                                    onEdit={handleEditClick}
                                    showEditBadge={true}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal No USB */}
                {showNoUSBErr && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="ri-usb-line text-red-600 text-3xl"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[#2D3A52] mb-2">No se encontraron unidades</h3>
                            <p className="text-[#2D3A52]/70 mb-6">
                                Conecta una memoria USB y vuelve a intentarlo.
                            </p>
                            <button
                                onClick={() => setShowNoUSBErr(false)}
                                className="bg-[#2D3A52] text-white py-3 px-6 rounded-xl font-medium hover:bg-[#2D3A52]/90 transition-colors"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Editor */}
                {editingPhoto && (
                    <ImageEditorModal
                        photo={editingPhoto}
                        aspectRatio={selectedSize ? (selectedSize.width / selectedSize.height) : undefined}
                        onClose={() => setEditingPhoto(null)}
                        onSave={handleSaveEdit}
                    />
                )}
                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-8 text-center">
                            <div className="w-16 h-16 bg-[#D75F1E] rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <i className="ri-loader-4-line text-white text-3xl animate-spin"></i>
                            </div>
                            <p className="text-lg font-medium text-[#2D3A52]">Procesando...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KioskUploadView;
