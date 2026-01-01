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

        const customNames = formData.getAll('customNames') as string[];

        // Check consistency
        if (customNames.length > 0 && customNames.length !== files.length) {
            console.warn("Mismatch between files and customNames count");
        }

        const uploadedFiles = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            let fileName;
            if (customNames[i]) {
                // Use provided name (security: sanitize directory traversal)
                fileName = path.basename(customNames[i]);
            } else {
                // Sanitizar nombre de archivo y agregar timestamp
                const timestamp = Date.now();
                const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                fileName = `${timestamp}_${sanitizedOriginalName}`;
            }

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
