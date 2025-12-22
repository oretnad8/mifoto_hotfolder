import { copy, mkdir, pathExists, unlink } from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { prisma } from './db';

// Directories
export const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'temp_uploads');
const PRINT_BASE_PATH = process.env.PRINT_BASE_PATH || 'C:\\DNP\\HotFolderPrint\\Prints';

// Types for Print Configuration
interface PrintConfig {
    folderName: string;
    needsProcessing: boolean;
    imageWidth?: number;
    imageHeight?: number;
    canvasWidth?: number;
    canvasHeight?: number;
}

// Configuration for each size
const PRINT_CONFIGS: Record<string, PrintConfig> = {
    'kiosco': { folderName: 's4x6', needsProcessing: false }, // 4x6" (10x15cm) - Native
    'large': { folderName: 's6x8', needsProcessing: false },  // 6x8" (15x20cm) - Native
    'square-large': { folderName: 's6x6', needsProcessing: false }, // 6x6" (15x15cm) - Native
    'medium': {
        folderName: 's6x8', // Prints on 6x8 paper
        needsProcessing: true,
        imageWidth: 1500, // 5" @ 300dpi
        imageHeight: 2100, // 7" @ 300dpi
        canvasWidth: 1800, // 6" @ 300dpi
        canvasHeight: 2400 // 8" @ 300dpi
    },
    'square-small': {
        folderName: 's6x6', // Prints on 6x6 paper
        needsProcessing: true,
        imageWidth: 1500, // 5" @ 300dpi
        imageHeight: 1500, // 5" @ 300dpi
        canvasWidth: 1800, // 6" @ 300dpi
        canvasHeight: 1800 // 6" @ 300dpi
    }
};

/**
 * Process and save image using Sharp
 * Resizes the image and centers it on a white canvas
 */
async function processAndSaveImage(
    sourcePath: string,
    targetPath: string,
    config: PrintConfig
) {
    if (!config.imageWidth || !config.imageHeight || !config.canvasWidth || !config.canvasHeight) {
        throw new Error('Missing dimensions in config for processing');
    }

    try {
        const image = sharp(sourcePath);
        const metadata = await image.metadata();

        // 1. Handle Orientation (EXIF) and Auto-Rotate for best fit
        // Note: .rotate() with no args auto-orients based on EXIF
        let pipeline = image.rotate();

        // We need to check dimensions AFTER EXIF rotation.
        // Sharp's metadata is based on the input file, so if we want "oriented" dimensions, 
        // we might rely on the assumption that most phones/cameras set Orientation tag.
        // However, to simplicity, we can just process the rotation.

        // Let's analyze simple aspect ratio matching.
        // If the target is Portrait (Height > Width)
        // AND the Input is Landscape (Width > Height)
        // WE SHOULD ROTATE 90 degrees to maximize print area.

        // Since we can't easily get the "rotated" metadata without reading the buffer,
        // we'll do a two-step approach or rely on buffer.

        const buffer = await pipeline.toBuffer();
        const orientedImage = sharp(buffer);
        const orientedMeta = await orientedImage.metadata();

        let rotate90 = false;

        if (orientedMeta.width && orientedMeta.height) {
            const inputIsLandscape = orientedMeta.width > orientedMeta.height;
            const targetIsPortrait = config.imageHeight > config.imageWidth;

            // If orientations oppose, rotate 90 deg
            if (inputIsLandscape && targetIsPortrait) {
                rotate90 = true;
            }
        }

        if (rotate90) {
            // Re-wrap the buffer-based instance to apply rotation
            // Note: sharp instances are immutable-ish streams, better to chain or new instance
            pipeline = orientedImage.rotate(90);
        } else {
            pipeline = orientedImage;
        }

        // 2. Resize with cover to fill the 5x7 area (cropping if necessary)
        const resizedImageBuffer = await pipeline
            .resize(config.imageWidth, config.imageHeight, {
                fit: 'cover', // crop to cover the dimensions
                position: 'center', // crop from center
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .toBuffer();

        // 3. Create white canvas and composite
        await sharp({
            create: {
                width: config.canvasWidth,
                height: config.canvasHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
            }
        })
            .composite([
                {
                    input: resizedImageBuffer,
                    gravity: 'center' // Center the image on the canvas
                }
            ])
            .withMetadata({ density: 300 }) // Set DPI to 300
            .jpeg({ quality: 95 }) // Output high quality JPEG
            .toFile(targetPath);

        console.log(`Processed and saved to: ${targetPath}`);

    } catch (error) {
        console.error(`Error processing image with sharp: ${error}`);
        throw error; // Re-throw to be handled by caller
    }
}

export async function moveOrderFilesToHotFolder(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
    });

    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.filesCopied) return; // Already processed

    const items = order.items as any[]; // Type assertion for JSON structure

    try {
        for (const item of items) {
            const sizeId = item.size.id;
            const config = PRINT_CONFIGS[sizeId];

            if (!config) {
                console.warn(`No config found for size: ${sizeId}, skipping...`);
                continue;
            }

            const targetDir = path.join(PRINT_BASE_PATH, config.folderName);

            // Ensure target directory exists
            await mkdir(targetDir, { recursive: true });

            for (const photo of item.photos) {
                console.log(`Processing file copy. Photo object:`, photo);
                const fileName = photo.fileName;

                if (!fileName) {
                    console.error(`Missing fileName for photo in order ${orderId}`, photo);
                    continue;
                }

                const sourcePath = path.join(TEMP_UPLOAD_DIR, fileName);
                const targetName = `${orderId.slice(0, 8)}_${fileName}`;
                const targetPath = path.join(targetDir, targetName);

                if (!(await pathExists(sourcePath))) {
                    console.warn(`Source file not found: ${sourcePath}`);
                    continue;
                }

                if (config.needsProcessing) {
                    try {
                        await processAndSaveImage(sourcePath, targetPath, config);
                    } catch (err) {
                        console.error(`Failed to process image ${fileName}, falling back to copy.`, err);
                        // Fallback: simple copy if sharp fails
                        await copy(sourcePath, targetPath);
                    }
                } else {
                    // Direct copy for native sizes
                    await copy(sourcePath, targetPath);
                }
            }
        }

        // Update order status
        await prisma.order.update({
            where: { id: orderId },
            data: { filesCopied: true }
        });

    } catch (error) {
        console.error(`Error moving files for order ${orderId}:`, error);
        throw error;
    }
}
