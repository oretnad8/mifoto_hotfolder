const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { pathToFileURL } = require('url');
const os = require('os');

let mainWindow;

// Register privileges BEFORE app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'local-media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

// Register a custom protocol to serve local files securely
function registerLocalProtocol() {
    protocol.handle('local-media', (request) => {
        // Current Strategy: Use a dummy host 'resource' to prevent Browser from treating Drive Letter as Host.
        // Format: local-media://resource/D:/path/file.jpg

        // 1. Remove Scheme and Dummy Host
        // Matches "local-media://resource/" or just "local-media://" if fallback
        let urlPath = request.url.replace(/^local-media:\/\/resource\//, '');
        urlPath = urlPath.replace(/^local-media:\/\//, ''); // Fallback cleaning

        // 2. Decode URI components (spaces, symbols)
        let filePath = decodeURIComponent(urlPath);

        // 3. Remove leading slashes if any remain (e.g. /D:/... -> D:/...)
        while (filePath.startsWith('/')) {
            filePath = filePath.substring(1);
        }

        // 4. "Repair" Drive Letter if Colon was stripped (Legacy/Fallback safety)
        // If we see "d/folder..." convert to "d:/folder..."
        if (/^[a-zA-Z]\//.test(filePath)) {
            filePath = filePath[0] + ':' + filePath.substring(1);
        }

        // 5. Normalize to OS Path
        const osPath = path.normalize(filePath);

        // 6. Generate valid File URL
        const fileUrl = pathToFileURL(osPath).toString();

        console.log(`[local-media] Req: ${request.url} -> Path: ${filePath} -> OS: ${osPath} -> FileURL: ${fileUrl}`);

        return net.fetch(fileUrl);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 1000,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true // Keep true and use custom protocol
        },
        // Kiosk mode options (enable later for production)
        // kiosk: true, 
        // fullscreen: true,
        autoHideMenuBar: true,
    });

    // Load the Next.js app
    // In development, we wait for localhost:3000
    // In production, we might load a file if we export, but for now we follow the plan to load localhost
    const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    mainWindow.loadURL(startUrl);

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    registerLocalProtocol();
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

// Helper: List drives via PowerShell to avoid native dependencies
function getDrives() {
    return new Promise((resolve, reject) => {
        const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, DriveType, VolumeName | ConvertTo-Json"`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error("PowerShell error:", error);
                resolve([]); // Fail gracefully
                return;
            }
            try {
                // Parse JSON output. Note: PowerShell might return a single object or array.
                let drives = JSON.parse(stdout);
                if (!Array.isArray(drives)) {
                    drives = [drives];
                }

                // Map to a simplified structure similar to drivelist for frontend compatibility
                const mapped = drives.map(d => ({
                    mountpoints: [{ path: d.DeviceID + '\\' }], // Add trailing slash consistent with Windows
                    isRemovable: d.DriveType === 2, // 2 = Removable
                    isUSB: d.DriveType === 2,       // Assumption for simplicity
                    isSystem: d.DeviceID === 'C:',
                    label: d.VolumeName || 'Sin Nombre'
                }));

                resolve(mapped);
            } catch (e) {
                console.error("Error parsing drive JSON:", e);
                resolve([]);
            }
        });
    });
}

// IPC: Get Removable Drives
ipcMain.handle('get-removable-drives', async () => {
    try {
        const drives = await getDrives();
        // Filter for removable or non-system drives that are likely external (Type 2 is Removable, Type 3 is Local but could be External HDD)
        // We strictly look for Type 2 or anything not C: if we want to be generous?
        // Let's stick to isRemovable (Type 2) OR (Type 3 and NOT C:)
        const removable = drives.filter(drive => drive.isRemovable || (drive.mountpoints[0].path !== 'C:\\'));

        return { success: true, drives: removable };
    } catch (error) {
        console.error('Error listing drives:', error);
        return { success: false, error: error.message };
    }
});

// Helper for recursive scanning
function scanDir(dir, depth = 0, maxDepth = 3, filesList = []) {
    if (depth > maxDepth) return filesList;

    try {
        const list = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of list) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Ignore hidden folders or system folders to speed up
                if (!entry.name.startsWith('.') && entry.name !== '$RECYCLE.BIN' && entry.name !== 'System Volume Information') {
                    scanDir(fullPath, depth + 1, maxDepth, filesList);
                }
            } else {
                if (/\.(jpg|jpeg|png|heic)$/i.test(entry.name)) {
                    // NORMALIZE PATH: Convert backslashes to forward slashes for URL
                    const normalizedPath = fullPath.replace(/\\/g, '/');

                    filesList.push({
                        name: entry.name,
                        path: fullPath, // Keep original OS path for logic if needed
                        // Use dummy host 'resource' so browser respects the drive letter path
                        preview: `local-media://resource/${normalizedPath}`
                    });
                }
            }
        }
    } catch (e) {
        // Ignore access errors
    }
    return filesList;
}

// IPC: Scan Directory
ipcMain.handle('scan-directory', async (event, rootPath) => {
    console.log('Scanning directory:', rootPath);
    try {
        // If rootPath provides a mount path like "E:\" ensure it ends correctly
        // But fs.readdirSync("E:") might work depending on CWD. "E:/" is safer or "E:\\"

        const images = scanDir(rootPath);
        return { success: true, files: images };
    } catch (error) {
        console.error('Error scanning directory:', error);
        return { success: false, error: error.message };
    }
});

// IPC: Get Local IP
ipcMain.handle('get-local-ip', async () => {
    const interfaces = os.networkInterfaces();
    let ip = '';

    // Iterate over interfaces to find the first non-internal IPv4
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (localhost) and non-IPv4
            if (iface.family === 'IPv4' && !iface.internal) {
                // Return the first valid one we find
                return iface.address;
            }
        }
    }
    return null;
});

// Deprecated mock handler, keeping for fallback if needed but replacing 'scan-usb' functionality
ipcMain.handle('scan-usb', async () => {
    // Redirect to scanning a default mock path if called, 
    // but frontend should now use get-removable-drives + scan-directory
    return { success: false, error: "Use get-removable-drives and scan-directory" };
});
