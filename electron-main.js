require('dotenv').config(); // Load environment variables
const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');

// Register local-media as privileged to allow fetch API support (blob/stream)
protocol.registerSchemesAsPrivileged([
    { scheme: 'local-media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
]);
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const { spawn, fork } = require('child_process');
const fs = require('fs');

let mainWindow;
let bluetoothServerProcess = null;
let internalServerProcess = null;
let store = null;

// Helper for robust HWID generation
function getRobustMachineId(s) {
    let hwid = null;
    try {
        hwid = machineIdSync({ original: true });
    } catch (e) {
        try { hwid = machineIdSync(); } catch (e2) { }
    }

    if (!hwid && s) {
        hwid = s.get('fallback_hwid');
        if (!hwid) {
            const crypto = require('crypto');
            hwid = crypto.randomUUID();
            s.set('fallback_hwid', hwid);
            console.log('[HWID] Generated and saved new fallback HWID:', hwid);
        }
    }
    return hwid;
}

// --------------------------------------------------------------------------
// Logging Helper
// --------------------------------------------------------------------------
const logPath = path.join(app.getPath('userData'), 'main.log');

function logToFile(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    try {
        fs.appendFileSync(logPath, line);
    } catch (e) {
        // Can't log to file? specific fail
        console.error('Log failure:', e);
    }
}

// Wrap console methods to also log to file
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
    originalLog(...args);
    logToFile('[INFO] ' + args.map(a => String(a)).join(' '));
};

console.error = function (...args) {
    originalError(...args);
    logToFile('[ERROR] ' + args.map(a => String(a)).join(' '));
};

console.log(`[Startup] UserData: ${app.getPath('userData')}`);
console.log(`[Startup] ResourcesPath: ${process.resourcesPath}`);
console.log(`[Startup] AppPath: ${app.getAppPath()}`);
console.log(`[Startup] __dirname: ${__dirname}`);
console.log(`[Startup] process.execPath: ${process.execPath}`);
// Removed verbose App Root listing to avoid user confusion


// --------------------------------------------------------------------------
// Resource Path Helpers
// --------------------------------------------------------------------------

function getResourcesPath() {
    return app.isPackaged ? process.resourcesPath : __dirname;
}

// --------------------------------------------------------------------------
// Internal Server Management (Production Only)
// --------------------------------------------------------------------------

function startInternalServer() {
    return new Promise((resolve, reject) => {
        // Only run internal server if packaged (Production)
        // In Dev, we expect 'concurrently' to run the server.
        if (!app.isPackaged) {
            console.log('[Internal Server] Development mode detected. Skipping internal server launch.');
            return resolve(true);
        }

        // ISSUE FIX: 'server.js' is bundled in 'files', so it lives inside key App ASAR or bundle root.
        // It is NOT in 'process.resourcesPath' (which is the parent folder of app.asar).
        // It should be a sibling of electron-main.js usually.
        let serverScript = path.join(__dirname, 'server.js');

        // Paranoid check: If __dirname is inside asar, fs.existsSync might work thanks to Electron patches.
        console.log(`[Internal Server] Checking for server script at: ${serverScript}`);

        if (!fs.existsSync(serverScript)) {
            console.error(`[Internal Server] NOT FOUND at ${serverScript}`);

            // Fallback: Check app path directly
            serverScript = path.join(app.getAppPath(), 'server.js');
            console.log(`[Internal Server] Trying fallback: ${serverScript}`);

            if (!fs.existsSync(serverScript)) {
                return reject(new Error(`Server script not found at neither: \n${serverScript}\n(Check build/files config)`));
            }
        }

        console.log(`[Internal Server] Launching server from: ${serverScript}`);

        try {
            // Using fork to run server.js
            // set silent: true so we can listen to stdout/stderr
            console.log('[Internal Server] Spawning process explicitly via executable + script...');
            // FIX: CWD cannot be inside an ASAR archive. Use resourcesPath (real folder) instead.
            const spawnCwd = process.resourcesPath;
            console.log(`[Internal Server] Fork CWD: ${spawnCwd}`);

            // FIX: Tell Prisma where to find the native query engine (copied via extraResources)
            const prismaEnginePath = path.join(process.resourcesPath, 'prisma', 'query_engine-windows.dll.node');
            console.log(`[Internal Server] Setting PRISMA_QUERY_ENGINE_LIBRARY to: ${prismaEnginePath}`);

            console.log('[Internal Server] Forking server process...');
            // Used fork to ensure Electron context (ASAR support) but with valid CWD
            internalServerProcess = fork(serverScript, [], {
                cwd: spawnCwd,
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    RESOURCES_PATH: process.resourcesPath,
                    PRISMA_QUERY_ENGINE_LIBRARY: prismaEnginePath
                },
                stdio: ['ignore', 'pipe', 'pipe', 'ipc']
            });

            let started = false;

            internalServerProcess.stdout.on('data', (data) => {
                const message = data.toString();
                console.log(`[Internal Server]: ${message.trim()}`);

                // Detect when Next.js is ready
                if (message.includes('Ready on') || message.includes('Listening on')) {
                    if (!started) {
                        started = true;
                        resolve(true);
                    }
                }
            });

            internalServerProcess.stderr.on('data', (data) => {
                console.error(`[Internal Server Error]: ${data.toString().trim()}`);
            });

            internalServerProcess.on('error', (err) => {
                console.error('[Internal Server] Process error:', err);
                if (!started) reject(err);
            });

            internalServerProcess.on('exit', (code) => {
                console.log(`[Internal Server] Exited with code ${code}`);
                if (!started) reject(new Error(`Server exited immediately with code ${code}`));
            });

            // Fallback timeout in case "Ready on" string changes or is missed
            // Wait up to 15 seconds for server to start
            setTimeout(() => {
                if (!started) {
                    console.log('[Internal Server] Timeout waiting for "Ready" signal. Continuing anyway...');
                    // We continue, assuming it might be stuck or we missed the msg.
                    resolve(true);
                }
            }, 10000);

        } catch (e) {
            reject(e);
        }
    });
}

function stopInternalServer() {
    if (internalServerProcess) {
        console.log('[Internal Server] Stopping...');
        internalServerProcess.kill();
        internalServerProcess = null;
    }
}

// --------------------------------------------------------------------------
// Bluetooth Server Helper
// --------------------------------------------------------------------------

function startBluetoothServer() {
    return new Promise((resolve, reject) => {
        if (bluetoothServerProcess) {
            console.log('[Bluetooth] Server already running.');
            resolve({ success: true, hostname: 'Already Running' });
            return;
        }

        // Logic for paths:
        // Dev: __dirname/resources/bin-bluetooth/...
        // Prod: process.resourcesPath/bin-bluetooth/...

        let executablePath;
        if (app.isPackaged) {
            // Production
            executablePath = path.join(process.resourcesPath, 'bin-bluetooth', 'BluetoothServer.exe');
        } else {
            // Development
            executablePath = path.join(__dirname, 'resources', 'bin-bluetooth', 'BluetoothServer.exe');
        }

        console.log(`[Bluetooth] Launching server from: ${executablePath}`);

        try {
            const proc = spawn(executablePath, [], {
                cwd: path.dirname(executablePath),
                stdio: ['ignore', 'pipe', 'pipe']
            });

            bluetoothServerProcess = proc;
            let started = false;

            proc.stdout.on('data', (data) => {
                const message = data.toString().trim();
                console.log(`[Bluetooth-Server]: ${message}`);

                try {
                    const lines = message.split('\n');
                    for (const line of lines) {
                        if (line.trim().startsWith('{')) {
                            const event = JSON.parse(line.trim());
                            if (event.event_type === 'started') {
                                started = true;
                                resolve({ success: true, hostname: event.hostname });
                            }
                            if (event.event_type === 'file_incoming' && mainWindow) {
                                mainWindow.webContents.send('bluetooth-file-incoming', event);
                            }
                            if (event.event_type === 'progress' && mainWindow) {
                                mainWindow.webContents.send('bluetooth-progress', event);
                            }
                            if (event.event_type === 'file_saved' && mainWindow) {
                                mainWindow.webContents.send('bluetooth-file-saved', event);
                            }
                            if (event.event_type === 'error' && mainWindow) {
                                mainWindow.webContents.send('bluetooth-error', event.message);
                            }
                        }
                    }
                } catch (e) {
                }
            });

            proc.stderr.on('data', (data) => {
                const message = data.toString().trim();
                console.error(`[Bluetooth-Error]: ${message}`);
            });

            proc.on('error', (err) => {
                console.error('[Bluetooth] Failed to start server:', err);
                if (!started) reject({ success: false, error: err.message });
            });

            proc.on('close', (code) => {
                console.log(`[Bluetooth] Server process exited with code ${code}`);
                if (bluetoothServerProcess === proc) {
                    bluetoothServerProcess = null;
                }
                if (!started) reject({ success: false, error: 'Process exited before starting' });
            });

            setTimeout(() => {
                if (!started && bluetoothServerProcess === proc) {
                    // Timeout logic could go here
                }
            }, 10000);

        } catch (error) {
            console.error('[Bluetooth] Exception spawning server:', error);
            reject({ success: false, error: error.message });
        }
    });
}

function stopBluetoothServer() {
    if (bluetoothServerProcess) {
        console.log('[Bluetooth] Stopping server...');
        bluetoothServerProcess.kill();
        bluetoothServerProcess = null;
    }
    return { success: true };
}

// --------------------------------------------------------------------------
// Window Creation
// --------------------------------------------------------------------------

function createWindow() {
    // Mode Checks
    const dev = !app.isPackaged;

    // Kiosk Options for Production
    const windowOptions = {
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
    };

    if (app.isPackaged) {
        // PRODUCTION: Kiosk Mode
        windowOptions.kiosk = true;
        windowOptions.fullscreen = true;
        windowOptions.frame = false;
        // Pone siempre al frente si es necesario, pero kiosk suele ser suficiente
        // windowOptions.alwaysOnTop = true; 
    }

    mainWindow = new BrowserWindow(windowOptions);

    // URL Loading Logic
    let dbSubdomain = store ? store.get('subdomain') : null;
    // Default fallback to local NEXT host
    // Use ENV or hardcoded localhost
    let targetUrl = 'https://localhost';

    if (dbSubdomain) {
        targetUrl = `https://${dbSubdomain}.localfoto.cl`;
        console.log(`[Window] Loading configured subdomain: ${targetUrl}`);
    } else if (process.env.NEXT_PUBLIC_HOST) {
        targetUrl = `https://${process.env.NEXT_PUBLIC_HOST}`;
        console.log(`[Window] Loading from ENV host: ${targetUrl}`);
    } else {
        console.log(`[Window] No subdomain configured. Loading local dev: ${targetUrl}`);
    }

    // Load with retry logic
    const loadUrlWithRetry = (url, retries = 3) => {
        mainWindow.loadURL(url).catch(err => {
            console.error(`[Window] Failed to load ${url}:`, err);
            if (retries > 0) {
                console.log(`[Window] Retrying in 2s... (${retries} left)`);
                setTimeout(() => loadUrlWithRetry(url, retries - 1), 2000);
            } else if (url !== 'https://localhost') {
                console.log('[Window] Fallback to https://localhost...');
                mainWindow.loadURL('https://localhost');
            }
        });
    };

    loadUrlWithRetry(targetUrl);

    if (dev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

const LICENSE_API_URL = 'http://dantero.ddns.net:3333/api/validate';

async function getStore() {
    if (!store) {
        const { default: Store } = await import('electron-store');
        store = new Store();
    }
    return store;
}

// Ignore certificate errors for self-signed certs (e.g. localhost)
app.commandLine.appendSwitch('ignore-certificate-errors');

app.whenReady().then(async () => {
    // Register local-media protocol handler
    protocol.registerFileProtocol('local-media', (request, callback) => {
        const url = request.url.replace('local-media://', '');
        console.log(`[Protocol] Handling request. Raw: ${request.url} -> Path: ${url}`);
        try {
            const decodedUrl = decodeURIComponent(url);
            console.log(`[Protocol] Servicing file: ${decodedUrl}`);
            return callback(decodedUrl);
        } catch (error) {
            console.error('[Protocol] Failed to register protocol for url:', url, error);
            // Verify if error needs callback? No, callback is for result. 
        }
    });

    // --------------------------------------------------------------------------
    // Database Setup (Production & Dev)
    // --------------------------------------------------------------------------
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'kiosk.db');

    // In production, we need to ensure the DB file exists in UserData
    // We copy it from resources/prisma/kiosk.db if it doesn't exist
    // Note: You must ensure 'prisma/kiosk.db' is included in extraResources in package.json
    let dbTemplatePath;
    if (app.isPackaged) {
        dbTemplatePath = path.join(process.resourcesPath, 'prisma', 'kiosk.db');
    } else {
        dbTemplatePath = path.join(__dirname, 'prisma', 'kiosk.db');
    }

    // Copy DB if missing
    if (!fs.existsSync(dbPath)) {
        console.log(`[Database] DB not found at ${dbPath}. Copying from template...`);
        try {
            // Ensure destination directory exists (userData always exists, but just in case)
            if (fs.existsSync(dbTemplatePath)) {
                fs.copyFileSync(dbTemplatePath, dbPath);
                console.log('[Database] DB initialized successfully.');
            } else {
                console.error(`[Database] Template DB not found at ${dbTemplatePath}. Cannot initialize DB.`);
            }
        } catch (err) {
            console.error('[Database] Failed to copy DB:', err);
        }
    } else {
        console.log(`[Database] DB exists at ${dbPath}`);
    }

    // Set DATABASE_URL env var so the internal server (and Prisma) picks it up
    // We use strict file: protocol. On Windows, replace backslashes if needed, but Node supports them usually.
    // Prisma prefers forward slashes or escaped backslashes.
    process.env.DATABASE_URL = `file:${dbPath}`;
    console.log(`[Database] DATABASE_URL set to: ${process.env.DATABASE_URL}`);

    // 1. Initialize Store
    await getStore();


    // 2. Start Internal Server (if Packaged)
    try {
        await startInternalServer();
    } catch (err) {
        console.error('[Startup] Failed to start internal server:', err);
        dialog.showErrorBox(
            'Error de Inicio',
            `No se pudo iniciar el servidor interno.\n\nDetalles: ${err.message}`
        );
        // Usually fatal, but we let it try to open window just in case user can config something?
        // Or quit? Standard kiosk behavior is to probably fail hard.
        // For now, allow continuation to see if it loads from network.
    }

    // 3. Pre-check / License Logic 
    const licenseKey = store.get('licenseKey');
    if (licenseKey) {
        try {
            console.log('[Startup] License found. Attempting back-end IP sync...');
            const hwid = getRobustMachineId(store);
            const localIp = getLocalIpAddress();

            const response = await axios.post(LICENSE_API_URL, {
                licenseKey: licenseKey,
                hwid: hwid,
                localIp: localIp
            }, { timeout: 3000 });

            if (response.data && response.data.valid === true) {
                console.log('[Startup] IP Sync successful.');
                if (response.data.subdomain) store.set('subdomain', response.data.subdomain);
                if (response.data.adminPassword) store.set('adminPassword', response.data.adminPassword);
                if (response.data.mpAccessToken) store.set('mpAccessToken', response.data.mpAccessToken);
                if (response.data.clientLogoUrl) store.set('clientLogoUrl', response.data.clientLogoUrl);
                if (response.data.welcomeText) store.set('welcomeText', response.data.welcomeText);
                if (response.data.validatorPassword) store.set('validatorPassword', response.data.validatorPassword);
                if (response.data.themeColor) store.set('themeColor', response.data.themeColor);
            }
        } catch (err) {
            console.warn('[Startup] IP Sync failed or timed out:', err.message);
        }
    }

    // 4. Create Window
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('before-quit', () => {
    stopBluetoothServer();
    stopInternalServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --------------------------------------------------------------------------
// IPC Handlers
// --------------------------------------------------------------------------

ipcMain.handle('bluetooth-start-listening', async () => {
    console.log('[IPC] bluetooth-start-listening triggered');
    try {
        const result = await startBluetoothServer();
        return result;
    } catch (err) {
        return { success: false, error: err.message || 'Unknown error' };
    }
});

ipcMain.handle('bluetooth-stop-listening', async () => {
    console.log('[IPC] bluetooth-stop-listening triggered');
    return stopBluetoothServer();
});

ipcMain.handle('bluetooth-open-wizard', async () => {
    return { success: true };
});

// Removed dummy handlers to avoid duplicates
// ipcMain.handle('get-removable-drives', async () => { return []; });
// ipcMain.handle('scan-directory', async () => { return []; });
const os = require('os');

ipcMain.handle('open-payment-modal', async (event, url) => {
    console.log('[Payment] Opening payment modal for URL:', url);

    if (!mainWindow) {
        return { success: false, error: 'Main window not found' };
    }

    const paymentWin = new BrowserWindow({
        parent: mainWindow,
        modal: true,
        width: 1000,
        height: 700,
        show: false,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            enableRemoteModule: false
        }
    });

    paymentWin.setMenu(null);
    paymentWin.loadURL(url);

    paymentWin.once('ready-to-show', () => {
        paymentWin.show();
    });

    const handleUrl = (url) => {
        console.log('[Payment] Checking URL:', url);
        if (url && url.includes('/checkout/status')) {
            const urlObj = new URL(url);
            const status = urlObj.searchParams.get('collection_status');
            console.log(`[Payment] Payment flow ended. Status: ${status}`);
            if (status === 'approved') {
                mainWindow.webContents.send('payment-success', { status: 'approved' });
            } else {
                mainWindow.webContents.send('payment-error', { error: `Payment status: ${status}` });
            }
            paymentWin.close();
            return true;
        }
        return false;
    };

    paymentWin.webContents.on('did-navigate', (event, url) => handleUrl(url));
    paymentWin.webContents.on('will-redirect', (event, url) => {
        if (handleUrl(url)) event.preventDefault();
    });
    paymentWin.webContents.on('will-navigate', (event, url) => {
        if (handleUrl(url)) event.preventDefault();
    });
    paymentWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.log('[Payment] Page failed to load:', validatedURL, errorDescription);
        handleUrl(validatedURL);
    });

    return { success: true };
});

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    const sortedInterfaceNames = Object.keys(interfaces).sort((a, b) => {
        const aPriority = (a.toLowerCase().includes('wi-fi') || a.toLowerCase().includes('ethernet')) ? -1 : 1;
        const bPriority = (b.toLowerCase().includes('wi-fi') || b.toLowerCase().includes('ethernet')) ? -1 : 1;
        return aPriority - bPriority;
    });

    for (const name of sortedInterfaceNames) {
        if (name.toLowerCase().includes('vmware') || name.toLowerCase().includes('virtual')) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

ipcMain.handle('get-local-ip', async () => { return getLocalIpAddress(); });

// FIX: Implement USB detection for Windows using PowerShell (avoids native dependency issues)
ipcMain.handle('get-removable-drives', async () => {
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        // Powershell: Get USB Disks -> Partitions -> DriveLetter & Label
        const cmd = 'powershell "Get-Disk | Where-Object { $_.BusType -eq \'USB\' } | Get-Partition | Where-Object { $_.DriveLetter } | Select-Object DriveLetter, @{N=\'VolumeLabel\';E={(Get-Volume -Partition $_).FileSystemLabel}} | ConvertTo-Json"';

        console.log('[USB] Scanning for drives (USB Bus)...');
        const { stdout } = await execPromise(cmd);

        let drives = [];
        if (stdout && stdout.trim()) {
            try {
                let parsed = JSON.parse(stdout);
                if (!Array.isArray(parsed)) parsed = [parsed];

                drives = parsed.map(d => ({
                    mountpoints: [{ path: d.DriveLetter + ':\\' }],
                    isRemovable: true,
                    label: d.VolumeLabel || `USB Drive ${d.DriveLetter}`,
                    isSystem: false
                }));
            } catch (e) {
                console.error('[USB] Error parsing PowerShell output:', e);
            }
        }

        console.log(`[USB] Found ${drives.length} drives.`);
        return { success: true, drives };
    } catch (error) {
        console.error('[USB] Error scanning drives:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('scan-directory', async (event, dirPath) => {
    try {
        const safePath = path.normalize(dirPath);
        console.log(`[Scan] Scanning directory: "${dirPath}" -> Normalized: "${safePath}"`);

        if (!fs.existsSync(safePath)) {
            console.log('[Scan] Path does not exist:', safePath);
            return { success: false, error: 'Path not found' };
        }

        const dirents = fs.readdirSync(safePath, { withFileTypes: true });
        const files = [];
        const folders = [];

        dirents.forEach(dirent => {
            const item = {
                name: dirent.name,
                path: path.join(safePath, dirent.name)
            };
            if (dirent.isDirectory()) {
                folders.push(item);
            } else {
                // Filter images only (JPG, JPEG, PNG, HEIC)
                const lower = dirent.name.toLowerCase();
                if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.heic') || lower.endsWith('.heif')) {
                    files.push({
                        ...item,
                        isDirectory: false,
                        preview: `local-media://${item.path.replace(/\\/g, '/')}`
                    });
                }
            }
        });

        return { success: true, files, folders };
    } catch (e) {
        console.error(`[Scan] Error scanning directory "${dirPath}" (Code: ${e.code}):`, e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-activation-status', async () => {
    const s = await getStore();
    const licenseKey = s.get('licenseKey');

    // Configured robust HWID
    const hwid = getRobustMachineId(s);

    let extraConfig = {
        clientLogoUrl: s.get('clientLogoUrl'),
        welcomeText: s.get('welcomeText'),
        validatorPassword: s.get('validatorPassword'),
        themeColor: s.get('themeColor')
    };

    if (licenseKey) {
        try {
            console.log('[License] Syncing with server...');
            const localIp = getLocalIpAddress();
            const response = await axios.post(LICENSE_API_URL, {
                licenseKey: licenseKey,
                hwid: hwid,
                localIp: localIp
            }, { timeout: 5000 });

            if (response.data && response.data.valid === true) {
                if (response.data.adminPassword) {
                    const currentPwd = s.get('adminPassword');
                    if (currentPwd !== response.data.adminPassword) {
                        s.set('adminPassword', response.data.adminPassword);
                    }
                }
                if (response.data.mpAccessToken) {
                    const currentToken = s.get('mpAccessToken');
                    if (currentToken !== response.data.mpAccessToken) {
                        s.set('mpAccessToken', response.data.mpAccessToken);
                    }
                }
                if (response.data.subdomain) {
                    console.log('[License] Received subdomain:', response.data.subdomain);
                    const currentSub = s.get('subdomain');
                    if (currentSub !== response.data.subdomain) {
                        s.set('subdomain', response.data.subdomain);
                        console.log('[License] Saved new subdomain to store:', response.data.subdomain);
                    }
                } else {
                    console.log('[License] No subdomain in server response.');
                }

                extraConfig = {
                    clientLogoUrl: response.data.clientLogoUrl,
                    welcomeText: response.data.welcomeText,
                    validatorPassword: response.data.validatorPassword,
                    themeColor: response.data.themeColor,
                    subdomain: response.data.subdomain,
                    mpAccessToken: response.data.mpAccessToken
                };

                if (extraConfig.clientLogoUrl !== undefined) s.set('clientLogoUrl', extraConfig.clientLogoUrl);
                if (extraConfig.welcomeText !== undefined) s.set('welcomeText', extraConfig.welcomeText);
                if (extraConfig.validatorPassword !== undefined) s.set('validatorPassword', extraConfig.validatorPassword);
                if (extraConfig.themeColor !== undefined) s.set('themeColor', extraConfig.themeColor);
            }
        } catch (err) {
            console.warn('[License] Sync failed (offline?):', err.message);
        }
    }

    return {
        active: !!licenseKey,
        licenseKey: licenseKey || null,
        hwid: hwid,
        ...extraConfig
    };
});

ipcMain.handle('activate-app', async (event, { licenseKey }) => {
    console.log('[Activation] Attempting to activate with key:', licenseKey);
    try {
        const s = await getStore();
        console.log('[Activation] Getting Machine ID...');
        const hwid = getRobustMachineId(s);
        console.log('[Activation] Machine ID obtained:', hwid);

        console.log('[Activation] Getting Local IP...');
        const localIp = getLocalIpAddress();
        console.log('[Activation] Local IP obtained:', localIp);

        console.log(`[Activation] Sending request to ${LICENSE_API_URL}...`);
        const response = await axios.post(LICENSE_API_URL, {
            licenseKey: licenseKey,
            hwid: hwid,
            localIp: localIp
        }, { timeout: 30000 });

        console.log('[Activation] Response received:', response.status);

        if (response.data && response.data.valid === true && response.data.adminPassword) {
            console.log('[Activation] License valid! Saving data...');
            const s = await getStore();
            s.set('licenseKey', licenseKey);
            s.set('adminPassword', response.data.adminPassword);

            if (response.data.mpAccessToken) s.set('mpAccessToken', response.data.mpAccessToken);
            if (response.data.subdomain) s.set('subdomain', response.data.subdomain);

            return {
                success: true,
                clientLogoUrl: response.data.clientLogoUrl,
                welcomeText: response.data.welcomeText,
                validatorPassword: response.data.validatorPassword,
                themeColor: response.data.themeColor
            };
        } else {
            console.error('[Activation] License rejected by server:', response.data);
            return { success: false, error: 'Licencia rechazada o datos incompletos.' };
        }
    } catch (err) {
        console.error('[Activation] Error during activation:', err);
        return { success: false, error: err.message || 'Error de conexión.' };
    }
});

ipcMain.handle('verify-admin-pin', async (event, pin) => {
    const s = await getStore();
    const saved = s.get('adminPassword');
    const match = String(saved).trim() === String(pin).trim();

    if (!match) {
        dialog.showMessageBox({
            type: 'error',
            title: 'Error de PIN',
            message: 'El PIN ingresado es incorrecto.'
        });
    }

    return match;
});
