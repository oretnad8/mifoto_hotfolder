
'use client';

import { useState, useRef, useCallback, ChangeEvent, DragEvent } from 'react';
import { Photo, Size } from '../types';
import ImageEditorModal from './ImageEditorModal';

interface PhotoUploadProps {
  selectedSize: Size | null;
  onPhotosUploaded: (photos: Photo[]) => void;
  onBack: () => void;
}

const PhotoUpload = ({ selectedSize, onPhotosUploaded, onBack }: PhotoUploadProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 50;
  const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/heic'];
  const MAX_DIMENSION = 12000;

  const isEvenOnlySize = (sizeId: string) => {
    return sizeId === 'kiosco';
  };

  const validateFile = (file: File) => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return 'Formato no soportado. Usa JPG, PNG o HEIC.';
    }
    if (file.size > 50 * 1024 * 1024) {
      return 'Archivo muy grande. Máximo 50MB.';
    }
    return null;
  };

  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        const maxSize = 1920;
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        if (ctx) ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const processFiles = async (files: FileList) => {
    setIsProcessing(true);
    const fileArray = Array.from(files);
    const newPhotos: any[] = [];

    for (const file of fileArray) {
      if (photos.length + newPhotos.length >= MAX_PHOTOS) break;

      const error = validateFile(file);
      if (error) {
        alert(error);
        continue;
      }

      const preview = await createImagePreview(file);
      const photoId = Date.now() + Math.random();

      newPhotos.push({
        id: photoId,
        file,
        preview,
        name: file.name
      });
    }

    setPhotos(prev => [...prev, ...newPhotos]);
    setIsProcessing(false);
  };

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  }, [photos.length]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  const handleContinue = async () => {
    if (photos.length > 0) {
      if (selectedSize && isEvenOnlySize(selectedSize.id)) {
        if (photos.length % 2 !== 0) {
          alert('El tamaño 4x6" requiere una cantidad par de fotos (2, 4, 6, etc.)');
          return;
        }
      }

      setIsProcessing(true);
      try {
        // Process photos that have edits
        const processedPhotos = await Promise.all(photos.map(async (photo) => {
          if (photo.editParams) {
            // This photo has pending edits, process it on server
            const formData = new FormData();
            formData.append('file', photo.file);
            formData.append('params', JSON.stringify(photo.editParams));

            // Use a dynamic import or assuming processImage is available. 
            // We need to import processImage at the top. I will add the import in a separate step or assume it is done if I check imports.
            // Wait, I haven't imported processImage in PhotoUpload.tsx yet.
            // I should add the import.

            const { processImage } = await import('../actions/process-image');
            const result = await processImage(formData);

            if (result.success && result.data) {
              const dataUrl: string = result.data;
              const res = await fetch(dataUrl);
              const blob = await res.blob();
              const newFile = new File([blob], photo.file.name, { type: 'image/jpeg' });
              return {
                ...photo,
                file: newFile,
                preview: dataUrl
              };
            } else {
              console.error(`Error processing ${photo.name}:`, result.error);
              return photo; // Fallback to original
            }
          }
          return photo;
        }));

        onPhotosUploaded(processedPhotos);
      } catch (err) {
        console.error(err);
        alert('Hubo un error al procesar las imágenes editadas.');
      } finally {
        setIsProcessing(false);
      }

    } else {
      alert('Debes seleccionar al menos una foto con cantidad mayor a 0');
    }
  };

  const totalPhotos = photos.length;

  return (
    <div className="min-h-screen bg-white px-8 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#2D3A52] hover:text-[#D75F1E] transition-colors duration-200 whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-xl"></i>
            <span className="text-lg font-medium">Volver</span>
          </button>

          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-[#2D3A52] mb-2">Carga tus Fotos</h1>
            <p className="text-lg text-[#2D3A52]/70">Arrastra o selecciona las imágenes que deseas imprimir</p>
          </div>

          <div className="w-24"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Área de carga */}
          <div className="lg:col-span-2">
            <div
              className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${dragActive
                ? 'border-[#D75F1E] bg-[#D75F1E]/5'
                : 'border-[#CEDFE7] hover:border-[#D75F1E] hover:bg-[#FCF4F3]'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-24 h-24 bg-[#CEDFE7] rounded-full flex items-center justify-center mx-auto mb-6">
                <i className={`ri-upload-cloud-fill text-4xl ${dragActive ? 'text-[#D75F1E]' : 'text-[#2D3A52]'}`}></i>
              </div>

              <h3 className="text-2xl font-bold text-[#2D3A52] mb-4">
                {dragActive ? '¡Suelta tus fotos aquí!' : 'Arrastra tus fotos aquí'}
              </h3>

              <p className="text-[#2D3A52]/70 mb-6">
                o <span className="text-[#D75F1E] font-semibold">haz clic para seleccionar</span>
              </p>

              <div className="text-sm text-[#2D3A52]/60">
                <p>Formatos: JPG, PNG, HEIC</p>
                <p>Máximo: {MAX_PHOTOS} fotos | Tamaño: hasta 50MB c/u</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/heic"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Lista de fotos cargadas */}
            {photos.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-[#2D3A52] mb-4">
                  Fotos Cargadas ({photos.length})
                </h3>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-4">
                  {photos.map((photo: Photo) => (
                    <div
                      key={photo.id}
                      className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-xl p-4 flex items-center gap-4"
                    >
                      {/* Miniatura */}
                      <div
                        className="w-20 h-20 bg-white rounded-lg overflow-hidden shadow-md flex-shrink-0 relative group cursor-pointer"
                        onClick={() => setEditingPhoto(photo)}
                      >
                        <img
                          src={photo.preview}
                          alt={photo.name}
                          className="w-full h-full object-cover object-top"
                        />
                        {/* Overlay Editar */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <i className="ri-edit-line text-white text-2xl drop-shadow-md"></i>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#2D3A52] truncate">{photo.name}</p>
                        <p className="text-sm text-[#2D3A52]/70">
                          {(photo.file.size / 1024 / 1024).toFixed(1)} MB
                          {photo.editParams && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-[#D75F1E]/10 text-[#D75F1E] px-2 py-0.5 rounded-full font-bold uppercase">
                              <i className="ri-magic-line"></i> Editado
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Eliminar */}
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="w-10 h-10 bg-red-100 hover:bg-red-200 rounded-lg flex items-center justify-center transition-colors duration-200 cursor-pointer"
                      >
                        <i className="ri-delete-bin-line text-red-600"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Panel lateral de información */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6 sticky top-8">
              <h3 className="text-xl font-bold text-[#2D3A52] mb-6">Resumen del Pedido</h3>

              {/* Tamaño seleccionado */}
              <div className="mb-6">
                <h4 className="font-semibold text-[#2D3A52] mb-2">Tamaño Seleccionado</h4>
                <div className="bg-white/80 rounded-lg p-3">
                  <p className="font-medium text-[#2D3A52]">{selectedSize?.name}</p>
                  <p className="text-sm text-[#2D3A52]/70">{selectedSize?.dimensions}</p>
                  <p className="text-lg font-bold text-[#D75F1E]">${selectedSize?.price} c/u</p>
                </div>
              </div>

              {/* Contador de fotos */}
              <div className="mb-6">
                <h4 className="font-semibold text-[#2D3A52] mb-2">Total de Impresiones</h4>
                <div className="bg-white/80 rounded-lg p-3 text-center">
                  <p className="text-3xl font-bold text-[#D75F1E]">{totalPhotos}</p>
                  <p className="text-sm text-[#2D3A52]/70">impresiones</p>
                </div>
              </div>

              {/* Restricciones */}
              {selectedSize && isEvenOnlySize(selectedSize.id) && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <i className="ri-information-line text-yellow-600 mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Restricción de Cantidad</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Este tamaño requiere una cantidad par de fotos (2, 4, 6, etc.)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botón continuar */}
              {photos.length > 0 && (
                <button
                  onClick={handleContinue}
                  className="w-full bg-[#D75F1E] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#D75F1E]/90 transition-all duration-200 transform hover:scale-105 shadow-lg whitespace-nowrap"
                >
                  Continuar al Resumen
                  <i className="ri-arrow-right-line ml-2"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {isProcessing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-[#D75F1E] rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <i className="ri-upload-line text-white text-2xl"></i>
              </div>
              <p className="text-lg font-medium text-[#2D3A52]">Procesando fotos...</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edición */}
      {editingPhoto && (
        <ImageEditorModal
          photo={editingPhoto}
          aspectRatio={selectedSize ? (selectedSize.width / selectedSize.height) : undefined}
          onClose={() => setEditingPhoto(null)}
          onSave={(editParams, previewUrl) => {
            // Non-destructive update: Keep original 'file' but update 'preview' and 'editParams'
            setPhotos(prev => prev.map(p =>
              p.id === editingPhoto.id
                ? { ...p, preview: previewUrl, editParams: editParams }
                : p
            ));
            setEditingPhoto(null);
          }}
        />
      )}
    </div>
  );
};

export default PhotoUpload;
