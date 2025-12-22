import { copy, mkdir, pathExists } from 'fs-extra';
import path from 'path';
import { prisma } from './db';

// Directories
export const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'temp_uploads');
const PRINT_BASE_PATH = process.env.PRINT_BASE_PATH || 'C:\\DNP\\HotFolderPrint\\Prints';

const SIZE_FOLDER_MAP: Record<string, string> = {
    'kiosco': 's4x6',      // 10x15
    'medium': 's5x7',      // 13x18
    'large': 's6x8',      // 15x20
    'square-small': 's5x5', // 10x10
    'square-large': 's6x6'  // 15x15
};

export async function moveOrderFilesToHotFolder(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
    });

    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.filesCopied) return; // Already processed

    const items = order.items as any[]; // Type assertion for JSON structure

    for (const item of items) {
        const sizeId = item.size.id;
        const folderName = SIZE_FOLDER_MAP[sizeId] || sizeId;
        const targetDir = path.join(PRINT_BASE_PATH, folderName);

        // Ensure target directory exists
        await mkdir(targetDir, { recursive: true });

        for (const photo of item.photos) {
            // Assuming photo.name or photo.preview constains the filename used in temp
            // In the upload route, we returned the generated filename. 
            // We need to ensure the Order items contain the correct temp filename.
            // Setup: Frontend should send the temp filename in the order creation.

            // detailed logging to debug
            console.log(`Processing file copy. Photo object:`, photo);
            const fileName = photo.fileName;

            if (!fileName) {
                console.error(`Missing fileName for photo in order ${orderId}`, photo);
                continue; // Skip if no physical filename
            }
            // We'll rely on 'fileName' being the property storing the system-generated name

            const sourcePath = path.join(TEMP_UPLOAD_DIR, fileName);

            // We prefix with orderId to avoid collisions if multiple orders have same file?
            // Or just copy. The upload route already added a timestamp.
            // Let's add OrderID prefix for clarity in the lab.
            const targetName = `${orderId.slice(0, 8)}_${fileName}`;
            const targetPath = path.join(targetDir, targetName);

            if (await pathExists(sourcePath)) {
                await copy(sourcePath, targetPath);
            } else {
                console.warn(`Source file not found: ${sourcePath}`);
            }
        }
    }

    // Update order status
    await prisma.order.update({
        where: { id: orderId },
        data: { filesCopied: true }
    });
}
