'use client';

import { Photo } from '../types';

interface PhotoGridProps {
    photos: Photo[];
    onEdit?: (photo: Photo) => void;
    onDelete?: (photoId: string) => void;
    selectedIds?: Set<string | number>;
    onToggleSelect?: (photo: Photo) => void;
    showEditBadge?: boolean;
}

export default function PhotoGrid({
    photos,
    onEdit,
    onDelete,
    selectedIds,
    onToggleSelect,
    showEditBadge = true
}: PhotoGridProps) {

    const isSelectionMode = !!onToggleSelect;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto max-h-[60vh] p-2">
            {photos.map((photo: Photo) => {
                const isSelected = selectedIds ? selectedIds.has(photo.id) : false;

                return (
                    <div
                        key={photo.id}
                        className={`
                relative rounded-xl overflow-hidden shadow-sm transition-all duration-200 aspect-square group
                ${isSelectionMode && isSelected ? 'ring-4 ring-[#D75F1E] scale-95' : 'hover:shadow-md'}
                ${isSelectionMode && !isSelected ? 'opacity-90 hover:opacity-100' : ''}
            `}
                    >
                        {/* Click Handling for Selection */}
                        <div
                            className="w-full h-full cursor-pointer"
                            onClick={() => onToggleSelect && onToggleSelect(photo)}
                        >
                            <img
                                src={photo.preview}
                                alt={photo.name}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Selection Checkmark Overlay */}
                        {isSelectionMode && isSelected && (
                            <div className="absolute top-2 right-2 w-8 h-8 bg-[#D75F1E] rounded-full flex items-center justify-center shadow-lg z-10 pointer-events-none">
                                <i className="ri-check-line text-white text-xl"></i>
                            </div>
                        )}

                        {/* Overlays / Buttons */}
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Top Left: Edit Button */}
                            {onEdit && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(photo);
                                    }}
                                    className="absolute top-2 left-2 w-8 h-8 bg-white/90 hover:bg-white text-[#2D3A52] rounded-full flex items-center justify-center shadow-md pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Editar"
                                >
                                    <i className="ri-pencil-line"></i>
                                </button>
                            )}

                            {/* Bottom Right: Delete Button (Only if onDelete provided) */}
                            {onDelete && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(photo.id.toString());
                                    }}
                                    className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 hover:bg-red-50 text-red-600 rounded-full flex items-center justify-center shadow-md pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Eliminar"
                                >
                                    <i className="ri-delete-bin-line"></i>
                                </button>
                            )}

                            {/* Info Badge */}
                            {showEditBadge && photo.editParams && (
                                <div className="absolute bottom-2 left-2 pointer-events-none">
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-[#D75F1E] text-white px-2 py-0.5 rounded-full font-bold uppercase shadow-sm">
                                        <i className="ri-magic-line"></i>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
