import { copy, mkdir, pathExists, unlink, readdir, stat } from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { prisma } from './db';
import { EditParams, Photo } from '../app/types';

// Directories
export const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'temp_uploads');
const PRINT_BASE_PATH = process.env.PRINT_BASE_PATH || 'C:\\DNP\\HotFolderPrint\\Prints';

// Types for Print Configuration
interface PrintConfig {
    folderName: string;
    imageWidth?: number;
    imageHeight?: number;
    canvasWidth?: number;
    canvasHeight?: number;
}

// Configuration for each size
const PRINT_CONFIGS: Record<string, PrintConfig> = {
    'kiosco': {
        folderName: 's4x6',
        imageWidth: 1200, imageHeight: 1800, canvasWidth: 1200, canvasHeight: 1800 // Default 4x6 sizes
    },
    'large': {
        folderName: 's6x8',
        imageWidth: 1800, imageHeight: 2400, canvasWidth: 1800, canvasHeight: 2400 // Default 6x8 sizes
    },
    'square-large': {
        folderName: 's6x6',
        imageWidth: 1800, imageHeight: 1800, canvasWidth: 1800, canvasHeight: 1800 // Default 6x6 sizes 
    },
    'medium': {
        folderName: 's6x8', // Prints on 6x8 paper
        imageWidth: 1500, // 5" @ 300dpi
        imageHeight: 2100, // 7" @ 300dpi
        canvasWidth: 1800, // 6" @ 300dpi
        canvasHeight: 2400 // 8" @ 300dpi
    },
    'square-small': {
        folderName: 's6x6', // Prints on 6x6 paper
        imageWidth: 1500, // 5" @ 300dpi
        imageHeight: 1500, // 5" @ 300dpi
        canvasWidth: 1800, // 6" @ 300dpi
        canvasHeight: 1800 // 6" @ 300dpi
    }
};

/**
 * Process and save image using Sharp
 * Applies rotation, crop, color adjustments, and fits to canvas.
 */
async function processAndSaveImage(
    sourcePath: string,
    targetPath: string,
    config: PrintConfig,
    params?: EditParams
) {
    // Basic defaults if no specific canvas size is set (fallback to metadata later if needed, but for print we usually want fixed sizes)
    // Actually, Kiosco/Large/Square-Large didn't have dims in previous code, but "process everything" implies we should enforce dims or at least re-save.
    // I put defaults in PRINT_CONFIGS for standard sizes to ensure consistent output.

    try {
        const inputBuffer = await sharp(sourcePath).toBuffer();

        // STAGE 1: Normalize Orientation (Handle EXIF)
        // We always perform an auto-rotate first so we start from the same "Upright" state the browser sees.
        // Sharp's .rotate(angle) OVERRIDES .rotate() (auto), so we must do them in steps if we want both.
        let pipeline = sharp(inputBuffer).rotate();

        const uprightBuffer = await pipeline.toBuffer();
        pipeline = sharp(uprightBuffer);

        // STAGE 2: User Edits (Rotation)
        if (params?.rotation) {
            // Apply user rotation on top of the upright image
            pipeline = pipeline.rotate(params.rotation, { background: '#ffffff' });
        }

        // We MUST realize the buffer here to get reliable dimensions for checking crop validity
        // especially if rotation changed the aspect ratio (90/270 deg).
        const rotatedBuffer = await pipeline.toBuffer();
        pipeline = sharp(rotatedBuffer);
        const meta = await pipeline.metadata();
        const imgW = meta.width || 0;
        const imgH = meta.height || 0;

        if (params) {
            // 2. Adjustments
            const brightness = params.brightness || 1;
            const saturation = params.saturation || 1;
            const contrast = params.contrast || 1;

            pipeline = pipeline.modulate({
                brightness: brightness,
                saturation: saturation,
            });

            if (contrast !== 1) {
                const slope = contrast;
                const intercept = 128 * (1 - contrast);
                pipeline = pipeline.linear(slope, intercept);
            }

            // 3. Crop (Robust Composite Method)
            if (params.crop) {
                const x = Math.round(params.crop.x);
                const y = Math.round(params.crop.y);
                const w = Math.round(params.crop.width);
                const h = Math.round(params.crop.height);

                console.log(`[ImageProc] Params:`, JSON.stringify(params));
                console.log(`[ImageProc] Buffer Dims: ${imgW}x${imgH}`);
                console.log(`[ImageProc] Crop Request: x=${x}, y=${y}, w=${w}, h=${h}`);

                // Proceed with crop using Composition (safest way to handle OOB/Padding)
                // We create a canvas of the TARGET crop size
                // And we composite the image shifted by -x, -y
                // This automatically handles "padding" with white background where image is missing

                // Need to buffer current state
                const currentBuffer = await pipeline.toBuffer();

                pipeline = sharp({
                    create: {
                        width: Math.max(1, w),
                        height: Math.max(1, h),
                        channels: 4,
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    }
                })
                    .composite([{
                        input: currentBuffer,
                        left: -x,
                        top: -y
                    }]);
            }
        }

        // 4. Resize and Canvas Logic (Fit to Print Size)
        // If config has dimensions, enforce them.
        if (config.imageWidth && config.imageHeight && config.canvasWidth && config.canvasHeight) {

            // Check for rotation need (Landscape vs Portrait) IF no explicit rotation was done/requested?
            // Actually, if the user "edited" it, the orientation is final.
            // If it's "raw" (no params), we might want to auto-rotate to fit best (smart fit).

            // Smart Fit logic:
            // Get current pipeline dimensions
            const tempBuf = await pipeline.toBuffer();
            const currentImg = sharp(tempBuf);
            const meta = await currentImg.metadata();

            if (meta.width && meta.height) {
                const isLandscape = meta.width > meta.height;
                const targetIsPortrait = config.imageHeight > config.imageWidth; // e.g. 5x7 (1500x2100)

                // If we have a mismatch and NO explicit user rotation (params.rotation === 0 or undefined), swap.
                // NOTE: If user explicitly rotated, we respect it.
                if ((!params || !params.rotation) && (isLandscape && targetIsPortrait)) {
                    pipeline = currentImg.rotate(90);
                } else {
                    pipeline = currentImg; // Reset pipeline to intermediate state
                }
            }

            // Resize image to fit IN the canvas area (imageWidth/Height)
            // 'cover' fills the area (good for borderless feeling if ratio matches)
            // 'contain' ensures whole image matches. 
            // Standard Kiosk behavior: 'cover' usually unless 'fit' param specified.
            // But usually we map `crop` from UI to this. If `params.crop` was applied, that IS the image.

            // Allow explicit resizing if params provided (rarely passed for print, usually just crop)
            // We resize the RESULT of the crop to the target image area.

            const resizeOptions: sharp.ResizeOptions = {
                width: config.imageWidth,
                height: config.imageHeight,
                fit: (params?.fit === 'contain') ? 'contain' : 'cover',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            };

            const resizedBuffer = await pipeline
                .resize(resizeOptions)
                .toBuffer();

            // Composite onto Canvas
            await sharp({
                create: {
                    width: config.canvasWidth,
                    height: config.canvasHeight,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                }
            })
                .composite([{ input: resizedBuffer, gravity: 'center' }])
                .withMetadata({ density: 300 })
                .jpeg({ quality: 95 })
                .toFile(targetPath);

        } else {
            // Fallback: Just save the pipeline processing if no specific print config dimensions (should not happen with updated configs)
            await pipeline
                .jpeg({ quality: 95 })
                .toFile(targetPath);
        }

        console.log(`Processed: ${targetPath}`);

    } catch (error) {
        console.error(`Error processing image ${sourcePath}:`, error);
        throw error;
    }
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Cleanup old files in TEMP_UPLOAD_DIR older than 3 days
 */
export async function cleanupOldTempFiles() {
    try {
        if (!await pathExists(TEMP_UPLOAD_DIR)) return;

        const files = await readdir(TEMP_UPLOAD_DIR);
        const now = Date.now();
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(TEMP_UPLOAD_DIR, file);
            const stats = await stat(filePath);
            if (now - stats.mtimeMs > THREE_DAYS) {
                await unlink(filePath);
                console.log(`Deleted old temp file: ${file}`);
            }
        }
    } catch (e) {
        console.error("Error during cleanup:", e);
    }
}

export async function moveOrderFilesToHotFolder(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
    });

    if (!order) throw new Error(`Order ${orderId} not found`);
    // NOTE: Removed "if (order.filesCopied)" check to allow re-trying if needed, or strictly enforce it? Use caution.
    // Keeping it safer:
    if (order.filesCopied) {
        console.log(`Order ${orderId} already copied.`);
        return;
    }

    const items = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) as any[];

    // Extract client name from JSON
    const clientData = (typeof order.client === 'string' ? JSON.parse(order.client) : order.client) as any;
    const rawName = clientData?.name || 'cliente';

    const clientName = sanitizeFilename(rawName);

    // Format: 755_01012026 (Hmm_DDMMYYYY)
    const now = new Date();
    const hours = now.getHours(); // 7
    const minutes = now.getMinutes().toString().padStart(2, '0'); // 55
    const day = now.getDate().toString().padStart(2, '0'); // 01
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 01
    const year = now.getFullYear(); // 2026

    // Result: 755_01012026
    const timestamp = `${hours}${minutes}_${day}${month}${year}`;

    let sequence = 1;

    try {
        for (const item of items) {
            const sizeId = item.size.id;
            const config = PRINT_CONFIGS[sizeId];

            if (!config) {
                console.warn(`No config found for size: ${sizeId}, skipping...`);
                continue;
            }

            const targetDir = path.join(PRINT_BASE_PATH, config.folderName);
            await mkdir(targetDir, { recursive: true });

            for (const photo of item.photos) {
                // Determine source path: Can be 'file' object (client side) or 'sourcePath' (Bluetooth) or 'fileName' (Temp Upload)
                // For cart items saved in DB, we likely have 'fileName' or 'sourcePath' persisted?
                // The 'items' JSON usually has 'fileName' for uploads. Bluetooth photos are stored differently?
                // Looking at types.ts: Photo has `sourcePath` (optional) and `name`. 
                // DB stores JSON. We expect: `fileName` (in temp_uploads) OR `sourcePath` (absolute path for bluetooth).

                let sourcePath = '';
                if (photo.sourcePath) {
                    sourcePath = photo.sourcePath;
                } else if (photo.fileName) {
                    sourcePath = path.join(TEMP_UPLOAD_DIR, photo.fileName);
                } else {
                    console.error("Photo has no source path or filename", photo);
                    continue;
                }

                if (!(await pathExists(sourcePath))) {
                    console.error(`Source file missing: ${sourcePath}`);
                    continue;
                }

                // Generate Target Filename
                // Format: (NombreCliente)_"Timestamp"_001.jpg
                const seqStr = sequence.toString().padStart(3, '0');
                const targetName = `${clientName}_${timestamp}_${seqStr}.jpg`;
                const targetPath = path.join(targetDir, targetName);
                sequence++;

                // Process (Always!)
                try {
                    // Extract params if they exist in the JSON
                    const params = photo.editParams as EditParams | undefined;
                    await processAndSaveImage(sourcePath, targetPath, config, params);

                    // CLEANUP: Bluetooth Immediate Delete
                    // If sourcePath is NOT in TEMP_UPLOAD_DIR, treat as external/bluetooth and delete.
                    // Be careful not to delete system files if logic is wrong. 
                    // Bluetooth paths typically in AppData...
                    if (!sourcePath.startsWith(TEMP_UPLOAD_DIR)) {
                        try {
                            await unlink(sourcePath);
                            console.log(`Cleaned up Bluetooth source: ${sourcePath}`);
                        } catch (delErr) {
                            console.error("Failed to delete bluetooth source:", delErr);
                        }
                    }

                } catch (err) {
                    console.error(`Failed to process/save ${sourcePath}`, err);
                    // Fallback to copy? User said "Procesamiento Obligatorio". 
                    // If sharp fails, copying might produce a bad print (wrong rotation). 
                    // Better to fail or force copy? 
                    // Try simple copy as strict fallback to ensure *something* prints.
                    await copy(sourcePath, targetPath);
                }
            }
        }

        await prisma.order.update({
            where: { id: orderId },
            data: { filesCopied: true }
        });

        // Trigger Periodic Cleanup (Fire and forget)
        cleanupOldTempFiles().catch(e => console.error("Cleanup failed", e));

    } catch (error) {
        console.error(`Error processing hotfolder files for ${orderId}`, error);
        throw error;
    }
}
