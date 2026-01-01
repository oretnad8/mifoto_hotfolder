import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json({ success: false, error: 'Password required' }, { status: 400 });
        }

        // Determine path to config.json
        // On Windows: %APPDATA%\mifoto-hotfolder\config.json
        // We assume the app name is 'mifoto-hotfolder' based on package.json
        const appName = 'mifoto-hotfolder';
        let configPath = '';

        if (process.platform === 'win32') {
            configPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName, 'config.json');
        } else {
            // Fallback for Linux/Mac (though user is on Windows)
            configPath = path.join(os.homedir(), '.config', appName, 'config.json');
        }

        console.log('[API] Checking config at:', configPath);

        try {
            const data = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(data);
            const savedPassword = config.adminPassword;

            console.log('[API] Saved Password found:', !!savedPassword);

            // Compare
            // Simple string comparison
            if (String(savedPassword).trim() === String(password).trim()) {
                return NextResponse.json({ success: true });
            } else {
                return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
            }

        } catch (err: any) {
            console.error('[API] Error reading config file:', err);
            // If file doesn't exist or error, fail.
            // In dev/first-run, maybe fallback? 
            // User said "admin_token (la contraseña) ... proveniente del servidor".
            // If checking fails (file missing), deny.
            return NextResponse.json({ success: false, error: 'Configuration read failed' }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[API] Error in verify route:', error);
        return NextResponse.json({ success: false, error: 'Server fatal error' }, { status: 500 });
    }
}
