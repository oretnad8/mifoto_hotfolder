'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Photo, EditParams } from '../types';

interface ImageEditorModalProps {
    photo: Photo;
    aspectRatio?: number;
    onClose: () => void;
    onSave: (editParams: EditParams, previewUrl: string) => void;
}

export default function ImageEditorModal({ photo, aspectRatio, onClose, onSave }: ImageEditorModalProps) {
    const [crop, setCrop] = useState(photo.editParams?.crop || { x: 0, y: 0 });
    const [zoom, setZoom] = useState(photo.editParams?.scale || 1);
    const [rotation, setRotation] = useState(photo.editParams?.rotation || 0);

    // Color adjustments
    const [brightness, setBrightness] = useState(photo.editParams?.brightness || 1);
    const [contrast, setContrast] = useState(photo.editParams?.contrast || 1);
    const [saturation, setSaturation] = useState(photo.editParams?.saturation || 1);

    const [objectFit, setObjectFit] = useState<'contain' | 'cover'>(photo.editParams?.fit || 'cover');
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [imageSrc, setImageSrc] = useState<string>(photo.preview);
    const [mediaSize, setMediaSize] = useState<{ width: number, height: number } | null>(null);
    const [smartAspectRatio, setSmartAspectRatio] = useState<number | undefined>(aspectRatio);

    // Initial load logic: Prefer photo.file (original) to allow re-editing full image
    useEffect(() => {
        let objectUrl: string | null = null;
        if (photo.file) {
            objectUrl = URL.createObjectURL(photo.file);
            setImageSrc(objectUrl);
        } else {
            setImageSrc(photo.preview);
        }

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [photo.file, photo.preview]);

    // Handle Image Load to determine orientation and set Smart Aspect Ratio
    const onMediaLoaded = (mediaSize: { width: number, height: number }) => {
        setMediaSize(mediaSize);
        setZoom(1); // Reset zoom to 1 (Fit)

        if (aspectRatio) {
            const isImageLandscape = mediaSize.width > mediaSize.height;
            const isCropLandscape = aspectRatio > 1;

            if (isImageLandscape !== isCropLandscape) {
                // Mismatch! Rotate the crop frame to match image
                setSmartAspectRatio(1 / aspectRatio);
            } else {
                setSmartAspectRatio(aspectRatio);
            }
        }
    };

    // When crop completes
    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getRadianAngle = (degreeValue: number) => {
        return (degreeValue * Math.PI) / 180;
    };

    const rotateSize = (width: number, height: number, rotation: number) => {
        const rotRad = getRadianAngle(rotation);
        return {
            width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
            height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
        };
    };

    const createClientPreview = async (imageSrc: string, pixelCrop: any, rotation = 0) => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return null;
        }

        const maxSize = 2000; // Limit preview size
        const rotRad = getRadianAngle(rotation);

        // Calculate bounding box of the rotated image
        const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

        if (objectFit === 'contain' && smartAspectRatio) {
            // FIT Logic: Canvas must match the aspect ratio, containing the image.

            // 1. Determine canvas dimensions based on aspect ratio and image bounding box.
            // We want the canvas to be large enough to contain the rotated image.
            // Let's create a canvas that fully contains the image, but respects the target aspect ratio.

            // If aspect ratio is W/H.
            // If bBoxWidth / bBoxHeight > aspectRatio, then width is limiting factor.
            // Canvas Width = bBoxWidth. Canvas Height = bBoxWidth / aspectRatio.
            // Check if height covers bBoxHeight. bBoxWidth / AR >= bBoxHeight?
            // If AR is large (wide), Height might be small. 

            // Let's try to fit the image box INTO the aspect ratio box.
            // We set the canvas dimension to encompass the image BBox, then expand ONE dimension to match AR.

            let canvasWidth = bBoxWidth;
            let canvasHeight = bBoxHeight;

            if (canvasWidth / canvasHeight > smartAspectRatio) {
                // Image is wider than target. Limit is width.
                // We need more height to satisfy AR.
                canvasHeight = canvasWidth / smartAspectRatio;
            } else {
                // Image is taller than target. Limit is height.
                // We need more width.
                canvasWidth = canvasHeight * smartAspectRatio;
            }

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // 2. Fill White Background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 3. Draw Image Centered
            // We need to draw the rotated image in the center.
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rotRad);
            // Draw relative to center
            ctx.translate(-image.width / 2, -image.height / 2);

            ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
            ctx.drawImage(image, 0, 0);

        } else {
            // COVER Logic (Existing): standard crop
            canvas.width = bBoxWidth;
            canvas.height = bBoxHeight;

            // Safety: Fill White to avoid black borders if crop exceeds image
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
            ctx.rotate(rotRad);
            ctx.translate(-image.width / 2, -image.height / 2);

            ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`
            ctx.drawImage(image, 0, 0);

            // Extract the cropped area
            const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);

            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;
            ctx.putImageData(data, 0, 0);
        }

        // Optimization
        if (canvas.width > maxSize || canvas.height > maxSize) {
            const scale = maxSize / Math.max(canvas.width, canvas.height);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width * scale;
            tempCanvas.height = canvas.height * scale;
            const tCtx = tempCanvas.getContext('2d');
            if (tCtx) {
                tCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
                return tempCanvas.toDataURL('image/jpeg', 0.85);
            }
        }

        return canvas.toDataURL('image/jpeg', 0.85);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Use imageSrc (the original file) for generating the preview
            const previewUrl = await createClientPreview(imageSrc, croppedAreaPixels, rotation);

            if (!previewUrl) {
                throw new Error("Could not generate preview");
            }

            const editParams: EditParams = {
                rotation,
                scale: zoom,
                brightness,
                contrast,
                saturation,
                fit: objectFit,
                crop: croppedAreaPixels,
                aspectRatio: smartAspectRatio // Save the smart aspect ratio used!
            };

            onSave(editParams, previewUrl);
        } catch (error) {
            console.error(error);
            alert('Error generando vista previa');
            setIsSaving(false);
        }
    };

    // Generate CSS filter string for live preview in modal
    const filterStyle = {
        filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`
    };

    // Calculate Scale for Rotated "Fit" View to ensure it stays within bounds
    const mediaRatio = mediaSize ? mediaSize.width / mediaSize.height : 1;
    let fitScale = 1;
    if (objectFit === 'contain' && smartAspectRatio && (rotation % 180 !== 0)) {
        // Normalized Container: W=AR, H=1
        // Unrotated Image fitted in Container:
        const fitW = (mediaRatio > smartAspectRatio) ? smartAspectRatio : mediaRatio;
        const fitH = (mediaRatio > smartAspectRatio) ? smartAspectRatio / mediaRatio : 1;

        // Rotated Dimensions:
        const rotW = fitH;
        const rotH = fitW;

        // Scale to fit Container (AR, 1)
        const scaleX = smartAspectRatio / rotW;
        const scaleY = 1 / rotH;
        fitScale = Math.min(1, scaleX, scaleY);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="relative w-full h-full flex flex-col">

                {/* Top Bar */}
                <div className="h-16 px-6 flex items-center justify-between text-white bg-[#2D3A52]">
                    <h2 className="text-lg font-bold">Editar Foto</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <i className="ri-close-line text-2xl"></i>
                    </button>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 relative bg-black overflow-hidden bg-dot-pattern flex items-center justify-center p-8">
                    {objectFit === 'cover' ? (
                        <div className="relative w-full h-full" style={filterStyle}>
                            <Cropper
                                key={smartAspectRatio}
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={smartAspectRatio}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                                onCropComplete={onCropComplete}
                                onMediaLoaded={onMediaLoaded}
                                objectFit="contain" // Starts Fitted
                                showGrid={true}
                                restrictPosition={true} // Enforce limits
                                minZoom={1}
                            />
                        </div>
                    ) : (
                        // Static "Fit" View
                        <div
                            className="relative shadow-2xl bg-white flex items-center justify-center transition-all duration-300 ease-in-out"
                            style={{
                                aspectRatio: `${smartAspectRatio}`,
                                height: 'auto',
                                width: 'auto',
                                maxHeight: '100%',
                                maxWidth: '100%',
                            }}
                        >
                            <img
                                src={imageSrc}
                                alt="Preview"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    transform: `rotate(${rotation}deg) scale(${fitScale})`,
                                    filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Controls Panel */}
                <div className="bg-white/95 backdrop-blur shadow-2xl p-6 rounded-t-2xl space-y-6 max-w-4xl mx-auto w-full transition-all">

                    {/* Row 1: Tools */}
                    <div className="flex justify-center gap-4 flex-wrap">
                        {/* Rotation */}
                        <button
                            onClick={() => setRotation((r: number) => (r + 90) % 360)}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 text-[#2D3A52]"
                            title="Rotar 90º"
                        >
                            <i className="ri-rotate-clockwise-line text-2xl"></i>
                            <span className="text-xs font-medium">Rotar</span>
                        </button>

                        <div className="w-px h-10 bg-gray-200 self-center mx-2"></div>

                        {/* Fit Modes */}
                        <button
                            onClick={() => {
                                setObjectFit('cover');
                                setZoom(1);
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${objectFit === 'cover'
                                ? 'bg-[#D75F1E]/10 text-[#D75F1E] ring-1 ring-[#D75F1E]'
                                : 'hover:bg-gray-100 text-[#2D3A52]'
                                }`}
                        >
                            <i className="ri-fullscreen-line text-2xl"></i>
                            <span className="text-xs font-medium">Recortar</span>
                        </button>

                        <button
                            onClick={() => {
                                setObjectFit('contain');
                                setZoom(1);
                                setCrop({ x: 0, y: 0 }); // Reset position
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${objectFit === 'contain'
                                ? 'bg-[#D75F1E]/10 text-[#D75F1E] ring-1 ring-[#D75F1E]'
                                : 'hover:bg-gray-100 text-[#2D3A52]'
                                }`}
                        >
                            <i className="ri-aspect-ratio-line text-2xl"></i>
                            <span className="text-xs font-medium">Encajar</span>
                        </button>

                        <div className="w-px h-10 bg-gray-200 self-center mx-2"></div>

                        {/* Reset */}
                        <button
                            onClick={() => {
                                setCrop({ x: 0, y: 0 });
                                setZoom(1);
                                setRotation(0);
                                setBrightness(1);
                                setContrast(1);
                                setSaturation(1);
                                setObjectFit('cover');
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 text-[#2D3A52]"
                            title="Volver al original"
                        >
                            <i className="ri-restart-line text-2xl"></i>
                            <span className="text-xs font-medium">Restablecer</span>
                        </button>
                    </div>

                    {/* Row 2: Sliders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 px-4">

                        {/* Zoom - Disabled in 'contain' mode */}
                        <div className={`flex items-center gap-3 ${objectFit === 'contain' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                            <i className="ri-zoom-in-line text-[#2D3A52]"></i>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full accent-[#D75F1E] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Brightness */}
                        <div className="flex items-center gap-3">
                            <i className="ri-sun-line text-[#2D3A52]"></i>
                            <input
                                type="range"
                                min={0.5}
                                max={1.5}
                                step={0.05}
                                value={brightness}
                                onChange={(e) => setBrightness(Number(e.target.value))}
                                className="w-full accent-[#D75F1E] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Contrast */}
                        <div className="flex items-center gap-3">
                            <i className="ri-contrast-line text-[#2D3A52]"></i>
                            <input
                                type="range"
                                min={0.5}
                                max={1.5}
                                step={0.05}
                                value={contrast}
                                onChange={(e) => setContrast(Number(e.target.value))}
                                className="w-full accent-[#D75F1E] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Saturation */}
                        <div className="flex items-center gap-3">
                            <i className="ri-drop-line text-[#2D3A52]"></i>
                            <input
                                type="range"
                                min={0}
                                max={2}
                                step={0.05}
                                value={saturation}
                                onChange={(e) => setSaturation(Number(e.target.value))}
                                className="w-full accent-[#D75F1E] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                    </div>

                    {/* Row 3: Actions */}
                    <div className="flex gap-4 pt-2 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 py-3 rounded-xl font-bold text-[#2D3A52] bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-3 rounded-xl font-bold text-white bg-[#D75F1E] hover:bg-[#D75F1E]/90 transition-colors shadow-lg flex justify-center items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Procesando...
                                </>
                            ) : (
                                'Aplicar Cambios'
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
