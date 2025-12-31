'use client';

import { useState, useEffect } from 'react';
import { Photo, Size } from '../types';
import ImageEditorModal from './ImageEditorModal';
import PhotoGrid from './PhotoGrid';
import BluetoothUploadView from './BluetoothUploadView';
// import heic2any from 'heic2any'; // Removed static import

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
type ViewState = 'idle' | 'scanning_drives' | 'drive_selection' | 'scanning_files' | 'gallery' | 'bluetooth';

const KioskUploadView = ({ selectedSize, onPhotosUploaded, onBack }: KioskUploadViewProps) => {
    const [viewState, setViewState] = useState<ViewState>('idle');
    const [drives, setDrives] = useState<Drive[]>([]);

    // Navigation State
    const [currentPath, setCurrentPath] = useState<string>('');
    const [history, setHistory] = useState<string[]>([]);
    const [folders, setFolders] = useState<{ name: string, path: string }[]>([]);

    const [photos, setPhotos] = useState<Photo[]>([]);

    // GLOBAL SELECTION STATE: Map path/ID -> Photo Object
    // This ensures we don't lose selection when changing folders
    const [selectedPhotosMap, setSelectedPhotosMap] = useState<Map<string | number, Photo>>(new Map());

    const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showNoUSBErr, setShowNoUSBErr] = useState(false);

    // Derived generic Set for PhotoGrid compatibility
    const selectedIds = new Set(selectedPhotosMap.keys());

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

    // --- Step 2: Scan/Nav Logic ---
    const loadPath = async (path: string) => {
        setViewState('scanning_files');
        try {
            // @ts-ignore
            const result = await window.electron.scanDirectory(path);
            if (result.success) {
                // Map files with STABLE ID (path) so selection persists
                const scanned: Photo[] = (result.files || []).map((f: any) => ({
                    id: f.path, // STABLE ID
                    file: { name: f.name, size: 0, type: f.name.toLowerCase().endsWith('.heic') ? 'image/heic' : 'image/jpeg', path: f.path } as unknown as File,
                    preview: f.preview,
                    name: f.name,
                    sourcePath: f.path
                }));

                setPhotos(scanned);
                setFolders(result.folders || []);
                setCurrentPath(path);
                setViewState('gallery');
            } else {
                alert("Error al leer directorio.");
                setViewState('drive_selection'); // fallback
            }
        } catch (e) {
            console.error(e);
            alert("Error leyendo la ruta.");
            setViewState('drive_selection');
        }
    };

    const handleDriveSelect = (drive: Drive) => {
        const path = drive.mountpoints[0]?.path;
        if (!path) return;

        // Reset navigation stack
        setHistory([]);
        setSelectedPhotosMap(new Map()); // Optional: Clear selection on new drive? Or keep?
        // Let's clear to avoid mixing drives.
        loadPath(path);
    };

    const handleEnterFolder = (folderPath: string) => {
        setHistory(prev => [...prev, currentPath]);
        loadPath(folderPath);
    };

    const handleNavigateBack = () => {
        if (history.length === 0) {
            // Back to Drive Selection
            setViewState('drive_selection');
            setDrives([]); // Will re-scan if they click USB again or we can keep them?
            // Actually nice to keep drives but refresh? Let's go to drive_selection view.
            handleStartUsb(); // Refresh drives
            return;
        }

        const prevPath = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        loadPath(prevPath);
    };



    // --- HEIC Processing Logic ---
    useEffect(() => {
        const processHeics = async () => {
            const heicsToProcess = photos.filter(p =>
                (p.name.toLowerCase().endsWith('.heic') || p.name.toLowerCase().endsWith('.heif')) &&
                p.preview.startsWith('local-media://')
            );

            if (heicsToProcess.length === 0) return;

            // Process one by one
            for (const photo of heicsToProcess) {
                try {
                    console.log('Converting HEIC thumbnail for:', photo.name);
                    const res = await fetch(photo.preview);
                    const blob = await res.blob();

                    // heic2any returns Blob or Blob[]
                    const heic2any = (await import('heic2any')).default;
                    const convertedBlob = await heic2any({
                        blob,
                        toType: 'image/jpeg',
                        quality: 0.8 // Thumbnail quality
                    });

                    const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    const jpegUrl = URL.createObjectURL(finalBlob);

                    setPhotos(prev => prev.map(p =>
                        p.id === photo.id ? { ...p, preview: jpegUrl } : p
                    ));

                } catch (err) {
                    console.error('Error processing HEIC:', photo.name, err);
                }
            }
        };

        if (viewState === 'gallery') {
            processHeics();
        }
    }, [photos.length, viewState]); // Use length to trigger on load, but check content inside

    // --- Selection Logic ---
    const toggleSelect = (photo: Photo) => {
        const newMap = new Map(selectedPhotosMap);
        if (newMap.has(photo.id)) {
            newMap.delete(photo.id);
        } else {
            newMap.set(photo.id, photo);
        }
        setSelectedPhotosMap(newMap);
    };

    const selectAllInView = () => {
        const newMap = new Map(selectedPhotosMap);
        photos.forEach(p => newMap.set(p.id, p));
        setSelectedPhotosMap(newMap);
    };

    const deselectAll = () => {
        setSelectedPhotosMap(new Map());
    };

    // --- Editor Integration ---
    const handleEditClick = async (photo: Photo) => {
        if (!photo.file.size && (photo.file as any).path) {
            setIsProcessing(true);
            try {
                const res = await fetch(photo.preview);
                if (!res.ok) throw new Error("Failed to fetch local file");

                const blob = await res.blob();

                // Check if HEIC
                const isHeic = photo.name.toLowerCase().endsWith('.heic') || photo.name.toLowerCase().endsWith('.heif');

                let finalFile = new File([blob], photo.name, { type: res.headers.get('content-type') || 'image/jpeg' });
                let finalPreview = photo.preview;

                if (isHeic) {
                    console.log('Converting HEIC for editing...');
                    // Use heic2any on client to avoid server limitations/issues
                    try {
                        const heic2any = (await import('heic2any')).default;
                        const convertedBlob = await heic2any({
                            blob: blob,
                            toType: 'image/jpeg',
                            quality: 1.0 // High quality for editing
                        });

                        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                        finalPreview = URL.createObjectURL(finalBlob);

                        finalFile = new File(
                            [finalBlob],
                            photo.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
                            { type: 'image/jpeg' }
                        );

                    } catch (e) {
                        console.error("heic2any failed:", e);
                        throw new Error("No se pudo convertir la imagen HEIC: " + (e as any).message);
                    }
                }

                const hydratedPhoto = {
                    ...photo,
                    file: finalFile,
                    preview: finalPreview,
                    name: finalFile.name // Ensure name matches file name (e.g. .jpg)
                };

                // Update in view
                setPhotos(prev => prev.map(p => p.id === photo.id ? hydratedPhoto : p));
                // Update in selection map if exists
                if (selectedPhotosMap.has(photo.id)) {
                    const newMap = new Map(selectedPhotosMap);
                    newMap.set(photo.id, hydratedPhoto);
                    setSelectedPhotosMap(newMap);
                }

                setEditingPhoto(hydratedPhoto);
            } catch (e) {
                console.error("Error loading image for editing:", e);
                alert("Error al cargar la imagen para edición.");
            } finally {
                setIsProcessing(false);
            }
        } else {
            setEditingPhoto(photo);
        }
    };

    const handleSaveEdit = (editParams: any, previewUrl: string) => {
        const updatePhoto = (p: Photo) => ({
            ...p,
            preview: previewUrl,
            editParams: editParams
        });

        // Update view
        setPhotos(prev => prev.map(p => p.id === editingPhoto?.id ? updatePhoto(p) : p));

        // Update selection and Auto-select
        const newMap = new Map(selectedPhotosMap);
        if (editingPhoto) {
            newMap.set(editingPhoto.id, updatePhoto(editingPhoto));
        }
        setSelectedPhotosMap(newMap);

        setEditingPhoto(null);
    };

    // --- Submission ---
    const handleContinue = async () => {
        const allSelectedPhotos = Array.from(selectedPhotosMap.values());
        const selectedCount = allSelectedPhotos.length;

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

        setIsProcessing(true);
        try {
            // Hydrate all selected files (even those not in current view)
            const finalPhotos = await Promise.all(allSelectedPhotos.map(async p => {
                if (!p.file.size && (p.file as any).path) {
                    try {
                        const res = await fetch(p.preview);
                        const blob = await res.blob();
                        const newFile = new File([blob], p.name, { type: res.headers.get('content-type') || 'image/jpeg' });
                        return { ...p, file: newFile };
                    } catch (err) {
                        console.error("Failed to hydrate file for upload:", p.name, err);
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
                                // If inside a folder (history > 0), go back
                                if (history.length > 0) {
                                    handleNavigateBack();
                                } else {
                                    // Root -> Back to Drive Selection
                                    setViewState('drive_selection');
                                    setSelectedPhotosMap(new Map());
                                    setPhotos([]);
                                }
                            } else if (viewState === 'drive_selection' || viewState === 'bluetooth') {
                                setViewState('idle');
                                setDrives([]);
                            } else {
                                onBack();
                            }
                        }}
                        className="flex items-center gap-2 text-[#2D3A52] hover:text-[#D75F1E] transition-colors duration-200 whitespace-nowrap"
                    >
                        <i className="ri-arrow-left-line text-xl"></i>
                        <span className="text-lg font-medium">
                            {viewState === 'gallery' && history.length > 0 ? 'Subir Nivel' : 'Volver'}
                        </span>
                    </button>

                    <div className="text-center flex-1">
                        <h1 className="text-3xl font-bold text-[#2D3A52] mb-2">Modo Kiosco</h1>
                        <p className="text-lg text-[#2D3A52]/70 overflow-hidden text-ellipsis whitespace-nowrap px-4">
                            {viewState === 'idle' && 'Selecciona el método de entrada'}
                            {viewState === 'drive_selection' && 'Selecciona la unidad USB'}
                            {viewState === 'bluetooth' && 'Carga por Bluetooth'}
                            {viewState === 'gallery' && (
                                <span title={currentPath} className="font-mono text-base">
                                    {currentPath}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="w-24"></div>
                </div>

                {/* HEIC Processing Queue */}
                <div className="hidden">
                    {/* We use a specialized useEffect for processing instead of rendering elements */}
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
                                onClick={() => setViewState('bluetooth')}
                                className="flex flex-col items-center justify-center p-12 bg-[#F0F7FA] border-3 border-[#CEDFE7] hover:border-[#D75F1E] rounded-3xl transition-all group hover:bg-[#D75F1E]/5"
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
                                {viewState === 'scanning_drives' ? 'Buscando dispositivos...' : 'Leyendo contenido...'}
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
                                    <button onClick={selectAllInView} className="text-sm font-medium text-[#2D3A52] hover:text-[#D75F1E] flex items-center gap-1">
                                        <i className="ri-checkbox-multiple-line"></i> Seleccionar Vista
                                    </button>
                                    <div className="w-px h-4 bg-[#CEDFE7]"></div>
                                    <button onClick={deselectAll} className="text-sm font-medium text-[#2D3A52] hover:text-[#D75F1E] flex items-center gap-1">
                                        <i className="ri-checkbox-blank-line"></i> Limpiar Todo
                                    </button>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-[#2D3A52] text-lg">
                                        {selectedPhotosMap.size} <span className="font-normal text-sm text-[#2D3A52]/70">fotos</span>
                                    </span>
                                    <button
                                        onClick={handleContinue}
                                        disabled={selectedPhotosMap.size === 0}
                                        className={`
                                    px-6 py-2 rounded-lg font-bold shadow-md transition-all flex items-center gap-2
                                    ${selectedPhotosMap.size > 0
                                                ? 'bg-[#D75F1E] text-white hover:bg-[#D75F1E]/90 hover:scale-105'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                                `}
                                    >
                                        Continuar <i className="ri-arrow-right-line"></i>
                                    </button>
                                </div>
                            </div>

                            {/* FOLDERS & GRID */}
                            <div className="flex-1 bg-gray-50 rounded-2xl border border-[#CEDFE7] p-4 overflow-y-auto">
                                {/* Folders Section */}
                                {folders.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-sm font-semibold text-[#2D3A52]/70 mb-3 uppercase tracking-wider">Carpetas</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                            {folders.map((folder, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleEnterFolder(folder.path)}
                                                    className="flex flex-col items-center p-4 bg-white border border-[#CEDFE7] hover:border-[#D75F1E] rounded-xl hover:shadow-md transition-all group"
                                                >
                                                    <i className="ri-folder-3-fill text-4xl text-[#FFB020] group-hover:text-[#FFC040] mb-2"></i>
                                                    <span className="text-sm font-medium text-[#2D3A52] text-center break-all line-clamp-2 leading-tight">
                                                        {folder.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Photos Grid */}
                                {photos.length > 0 ? (
                                    <PhotoGrid
                                        photos={photos}
                                        selectedIds={selectedIds}
                                        onToggleSelect={toggleSelect}
                                        onEdit={handleEditClick}
                                        showEditBadge={true}
                                    />
                                ) : (
                                    <div className="text-center py-12 text-[#2D3A52]/50">
                                        {folders.length === 0 ? 'Carpeta vacía' : 'No hay imágenes en este nivel'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* View: BLUETOOTH */}
                    {viewState === 'bluetooth' && (
                        <BluetoothUploadView
                            onBack={() => setViewState('idle')}
                            onPhotosReceived={(received) => {
                                setPhotos(received);
                                setViewState('gallery');
                                // Determine folder structure or current path context if needed
                                setCurrentPath('Bluetooth Import');
                                setFolders([]);
                                // Auto-select all received?
                                const newMap = new Map();
                                received.forEach(p => newMap.set(p.id, p));
                                setSelectedPhotosMap(newMap);
                            }}
                        />
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
