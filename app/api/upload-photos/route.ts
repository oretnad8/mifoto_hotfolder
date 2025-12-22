import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { TEMP_UPLOAD_DIR } from '@/lib/file-service';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('photos') as File[];

        // Use temp directory
        const targetFolder = TEMP_UPLOAD_DIR;
        try {
            await mkdir(targetFolder, { recursive: true });
        } catch (err) {
            console.error('Error creating directory:', err);
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

            // Return structure compatible with Photo interface
            uploadedFiles.push({
                name: file.name,
                fileName: fileName, // The physical name on disk
            });
        }

        return NextResponse.json({
            success: true,
            files: uploadedFiles,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({
            error: 'Error al guardar archivos'
        }, { status: 500 });
    }
}
