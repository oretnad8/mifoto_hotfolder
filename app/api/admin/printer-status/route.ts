import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Path to the printer status log file
    const logFilePath = 'C:\\DNP\\HotFolderPrint\\Logs\\printer_status.txt';

    try {
        // Check if file exists
        if (!fs.existsSync(logFilePath)) {
            console.warn(`Printer status file not found at: ${logFilePath}`);
            return NextResponse.json([]);
        }

        // Read the file
        const fileContent = fs.readFileSync(logFilePath, 'utf-8');

        // Parse JSON
        // The file might contain a BOM or weird whitespace, standard JSON.parse should handle basic JSON
        const data = JSON.parse(fileContent);

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error reading printer status:', error);
        // Return empty array on error to prevent UI crash
        return NextResponse.json([]);
    }
}
