import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Define base path - adjust if running on a different OS/setup
const PRINT_BASE_PATH = process.env.PRINT_BASE_PATH || 'C:\\\\DNP\\\\HotFolderPrint\\\\Prints';

const SIZE_FOLDER_MAP: Record<string, string> = {
    'kiosco': 's4x6',      // 10x15cm. If 4x6 even split is handled by Hot Folder, mapped here.
    'medium': 's5x7',      // 13x18cm
    'large': 's6x20',      // 15x20cm
    'square-small': 's5x5', // 10x10cm
    'square-large': 's6x6'  // 15x15cm
};

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const sizeId = formData.get('sizeId') as string;
        const files = formData.getAll('photos') as File[];

        // Normalize sizeId if needed or validate
        const folderName = SIZE_FOLDER_MAP[sizeId];
        if (!folderName) {
            console.error(`Invalid size ID: ${sizeId}`);
            return NextResponse.json({ error: 'Tamaño inválido' }, { status: 400 });
        }

        // Ensure target directory exists
        const targetFolder = path.join(PRINT_BASE_PATH, folderName);
        try {
            await mkdir(targetFolder, { recursive: true });
        } catch (err) {
            console.error('Error creating directory:', err);
            // Depending on permissions, this might fail if parent doesn't exist
        }

        const uploadedFiles = [];
        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Sanitizar nombre de archivo y agregar timestamp
            const timestamp = Date.now();
            const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileName = `${timestamp}_${sanitizedOriginalName}`;
            const filePath = path.join(targetFolder, fileName);

            await writeFile(filePath, buffer);
            uploadedFiles.push(fileName);
        }

        return NextResponse.json({
            success: true,
            files: uploadedFiles,
            folder: folderName
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({
            error: 'Error al guardar archivos'
        }, { status: 500 });
    }
}
