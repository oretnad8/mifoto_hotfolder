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

// Helper: List drives via PowerShell Storage Module (Best for BusType)
function getDrives() {
    return new Promise((resolve) => {
        // We use Get-Partition + Get-Disk to find the TRUE BusType (USB vs SATA/SCSI)
        // script must be COMMENT FREE to avoid parsing errors
        const psScript = `
            $out = @();
            $logicals = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 3 };
            foreach ($l in $logicals) {
                $bus = "UNKNOWN";
                try {
                    $letter = $l.DeviceID.Substring(0,1);
                    $disk = Get-Partition -DriveLetter $letter -ErrorAction SilentlyContinue | Get-Disk -ErrorAction SilentlyContinue;
                    if ($disk) { 
                        $bus = $disk.BusType.ToString();
                    }
                } catch {
                }
                
                $out += @{ 
                    DeviceID = $l.DeviceID; 
                    DriveType = $l.DriveType; 
                    VolumeName = $l.VolumeName; 
                    BusType = $bus 
                };
            }
            $out | ConvertTo-Json -Depth 2
        `;

        // Sanitize command
        const safeCommand = psScript.replace(/\s+/g, ' ').trim();
        const cmd = `powershell -NoProfile -Command "& { ${safeCommand} }"`;

        exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error("PowerShell error:", error);
                resolve([]);
                return;
            }
            try {
                const raw = JSON.parse(stdout);
                const drives = Array.isArray(raw) ? raw : (raw ? [raw] : []);

                const mapped = drives.map(d => {
                    const driveLetter = d.DeviceID;
                    const isRemovableType = d.DriveType === 2;

                    // BusType check (Robust)
                    const bus = (d.BusType || '').toUpperCase();
                    const isUsbBus = bus === 'USB';

                    return {
                        mountpoints: [{ path: driveLetter + '\\' }],
                        isRemovable: isRemovableType || isUsbBus,
                        isUSB: isUsbBus,
                        isSystem: driveLetter.toUpperCase() === 'C:',
                        label: d.VolumeName || 'Sin Nombre',
                        _debugType: d.DriveType,
                        _debugBus: d.BusType
                    };
                });

                resolve(mapped);
            } catch (e) {
                console.error("Error parsing drive JSON:", e, stdout);
                resolve([]);
            }
        });
    });
}

// IPC: Get Removable Drives
ipcMain.handle('get-removable-drives', async () => {
    try {
        const drives = await getDrives();

        // Strict Filter:
        // 1. MUST NOT be C:
        // 2. MUST be either Removable Type (2) OR BusType USB
        const removable = drives.filter(drive =>
            !drive.isSystem &&
            (drive.isRemovable === true)
        );

        console.log("Detected Drives:", JSON.stringify(drives, null, 2));
        console.log("Filtered Removable:", JSON.stringify(removable, null, 2));

        return { success: true, drives: removable };
    } catch (error) {
        console.error('Error listing drives:', error);
        return { success: false, error: error.message };
    }
});

// Helper for NON-recursive scanning (Single folder level)
function scanDir(dir) {
    const response = {
        path: dir,
        folders: [],
        files: []
    };

    try {
        const list = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of list) {
            const fullPath = path.join(dir, entry.name);
            const normalizedPath = fullPath.replace(/\\/g, '/');

            if (entry.isDirectory()) {
                // Ignore hidden folders or system folders
                if (!entry.name.startsWith('.') &&
                    entry.name !== '$RECYCLE.BIN' &&
                    entry.name !== 'System Volume Information') {

                    response.folders.push({
                        name: entry.name,
                        path: fullPath
                    });
                }
            } else {
                if (/\.(jpg|jpeg|png|heic)$/i.test(entry.name)) {
                    response.files.push({
                        name: entry.name,
                        path: fullPath,
                        preview: `local-media://resource/${normalizedPath}`
                    });
                }
            }
        }
    } catch (e) {
        console.error(`Error reading dir ${dir}:`, e);
    }
    return response;
}

// IPC: Scan Directory
ipcMain.handle('scan-directory', async (event, rootPath) => {
    console.log('Scanning directory:', rootPath);
    try {
        // Ensure request is valid
        if (!rootPath) throw new Error("Path is required");

        const result = scanDir(rootPath);
        return { success: true, ...result };
    } catch (error) {
        console.error('Error scanning directory:', error);
        return { success: false, error: error.message };
    }
});

// IPC: Get Local IP
ipcMain.handle('get-local-ip', async () => {
    const interfaces = os.networkInterfaces();
    const candidates = [];

    // Collect all valid IPv4 non-internal addresses
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (localhost) and non-IPv4
            if (iface.family === 'IPv4' && !iface.internal) {
                candidates.push({ name, address: iface.address });
            }
        }
    }

    if (candidates.length === 0) return null;

    // 1. Try to find a Wireless/Wi-Fi interface
    const wifiCandidate = candidates.find(c => /wi-fi|wireless|wlan/i.test(c.name));
    if (wifiCandidate) return wifiCandidate.address;

    // 2. Fallback to the first available candidate
    return candidates[0].address;
});

// Deprecated mock handler, keeping for fallback if needed but replacing 'scan-usb' functionality
ipcMain.handle('scan-usb', async () => {
    // Redirect to scanning a default mock path if called, 
    // but frontend should now use get-removable-drives + scan-directory
    return { success: false, error: "Use get-removable-drives and scan-directory" };
});
