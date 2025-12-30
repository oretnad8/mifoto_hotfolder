'use server';

import sharp from 'sharp';
import { EditParams } from '../types';

export async function processImage(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        const paramsJson = formData.get('params') as string;

        if (!file || !paramsJson) {
            return { success: false, error: 'Datos incompletos' };
        }

        const params: EditParams = JSON.parse(paramsJson);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let pipeline = sharp(buffer);

        // 1. Rotate
        if (params.rotation) {
            pipeline = pipeline.rotate(params.rotation);
        }

        // 2. Adjustments (Brightness, Saturation, Contrast)
        // Sharp's modulate: brightness (multiplicative), saturation (multiplicative), lightness (additive)
        // We map contrast to linear correction roughly if needed, but sharp doesn't have direct 'contrast' in modulate.
        // A simple workaround for contrast is using linear() or just sticking to brightness/saturation if that's "good enough" for a kiosk.
        // The user requested Contrast. A common way to do contrast in sharp is via `linear(a, b)` where a is slope (contrast).
        // contrast 1 = slope 1. contrast 1.5 = slope 1.5.
        // We'll apply brightness/saturation first via modulate.

        const brightness = params.brightness || 1;
        const saturation = params.saturation || 1;
        const contrast = params.contrast || 1;

        pipeline = pipeline.modulate({
            brightness: brightness,
            saturation: saturation,
            // lightless: 0 // we can use lightness for additive brightness if needed
        });

        // Apply contrast using linear operation: new = old * slope + intercept
        // slope = contrast
        // To keep mid-grey (128) constant: intercept = 128 * (1 - contrast)
        if (contrast !== 1) {
            const slope = contrast;
            const intercept = 128 * (1 - contrast);
            pipeline = pipeline.linear(slope, intercept);
        }

        // 3. Crop / Resize
        // We expect `params.crop` to contain { x, y, width, height } in pixels.

        // 3. COLOR & ROTATION (Applied to pipeline)

        // 4. CROP / RESIZE / FIT
        // If Fit 'contain' is requested, we need to respect the target aspect ratio and add white padding.
        if (params.fit === 'contain' && params.aspectRatio) {
            // To ensure we don't lose quality, we should base the resize on the current image dimensions.
            // Sharp's `resize` with `fit: contain` does exactly this: it fits the image into the dimensions provided, 
            // maintaining aspect ratio, and filling the rest with `background`.

            // We need target dimensions. We can assume we want to keep the image's largest dimension as is.
            // First, we need to know the *current* dimensions after rotation.
            // We can resolve the pipeline so far to getting metadata? 
            // Or simpler: We just perform the crop if it exists (though usually 'contain' implies full image).
            // Actually, if 'contain' is on, `crop` is usually ignored or represents the whole image.

            // Let's get metadata first to know size.
            // Note: sharp pipeline is lazy. We need to be careful. 
            // Calling toBuffer() or metadata() might be needed.

            // Strategy: 
            // 1. Apply color/rotation.
            // 2. Buffer it.
            // 3. Re-open with Sharp to get dimensions.
            // 4. Apply Resize with contain.

            const tempBuffer = await pipeline.toBuffer();
            const tempImage = sharp(tempBuffer);
            const metadata = await tempImage.metadata();

            if (metadata.width && metadata.height) {
                // Determine target dimensions based on AR.
                // We want the resulting image to contain the input image.
                // Similar logic to frontend:
                let targetWidth = metadata.width;
                let targetHeight = metadata.height;

                // If current AR > target AR (Wider): Width is limiting.
                // Height needs to increase.
                if (targetWidth / targetHeight > params.aspectRatio) {
                    targetHeight = Math.round(targetWidth / params.aspectRatio);
                } else {
                    // Taller. Height is limiting. Width needs to increase.
                    targetWidth = Math.round(targetHeight * params.aspectRatio);
                }

                pipeline = tempImage.resize({
                    width: targetWidth,
                    height: targetHeight,
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                });
            }
        } else if (params.crop) {
            // Standard Crop (Cover/Fill)
            pipeline = pipeline.extract({
                left: Math.round(params.crop.x),
                top: Math.round(params.crop.y),
                width: Math.round(params.crop.width),
                height: Math.round(params.crop.height)
            });
        }

        // 5. RESIZE (Explicit)
        if (params.resize) {
            pipeline = pipeline.resize({
                width: params.resize.width,
                height: params.resize.height,
                fit: 'inside', // Or 'cover' depending on need, 'inside' preserves aspect ratio
                withoutEnlargement: true
            });
        }

        // For now, we trust `params.crop` defines the valid image area the user selected. 
        // If the user selected "Fit" in the UI, the UI shows the image inside the box. 
        // But `easy-crop`'s `croppedAreaPixels` essentially just gives the crop of the image itself.

        // Let's stick to returning the processed image data. The layout constraint (white bars) might be best handled 
        // when generating the final print file or if we knew the target dimensions here.
        // Re-reading: "el tamaño del lienzo de cada tamaño seleccionado debe resptarse"
        // This suggests we should probably pad if necessary. But we lack target dimensions in params.
        // I will assume for now that standard trimming is sufficient, and we focus on the color/rotation updates.

        const processedBuffer = await pipeline
            .jpeg({ quality: 90 })
            .toBuffer();

        const base64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

        return { success: true, data: base64 };

    } catch (error: any) {
        console.error('Error processing image:', error);
        return { success: false, error: error.message };
    }
}
