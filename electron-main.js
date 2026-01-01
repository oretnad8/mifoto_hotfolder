require('dotenv').config(); // Load environment variables
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { machineIdSync } = require('node-machine-id');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let bluetoothServerProcess = null;
let store; // To be initialized dynamically

// Helper to start the server and wait for the "started" event
function startBluetoothServer() {
    return new Promise((resolve, reject) => {
        if (bluetoothServerProcess) {
            console.log('[Bluetooth] Server already running.');
            resolve({ success: true, hostname: 'Already Running' }); // Or cache the real hostname
            return;
        }

        let executablePath;
        if (app.isPackaged) {
            executablePath = path.join(process.resourcesPath, 'bin-bluetooth', 'BluetoothServer.exe');
        } else {
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
                // Only clear global if this is the current process
                if (bluetoothServerProcess === proc) {
                    bluetoothServerProcess = null;
                }
                if (!started) reject({ success: false, error: 'Process exited before starting' });
            });

            // Safety timeout
            setTimeout(() => {
                if (!started && bluetoothServerProcess === proc) {
                    // Timeout logic if needed
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

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true, // Hide default menu
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
    });

    const dev = process.env.NODE_ENV === 'development';

    // Check if we should wait for port or just load?
    // In dev, usually wait-on handles it.
    if (dev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadURL('http://localhost:3000');
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

const LICENSE_API_URL = 'http://dantero.ddns.net:3333/api/validate';

// Lazy load store
async function getStore() {
    if (!store) {
        const { default: Store } = await import('electron-store');
        store = new Store();
    }
    return store;
}

app.whenReady().then(async () => {
    // Initialize store
    await getStore();

    // Bluetooth NO se inicia aquí. Se inicia bajo demanda.
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('before-quit', () => {
    stopBluetoothServer();
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
    // Implement system wizard if possible, or just ignore
    return { success: true };
});

// Other Stubs
ipcMain.handle('get-removable-drives', async () => { return []; });
ipcMain.handle('scan-directory', async () => { return []; });
const os = require('os');

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    const sortedInterfaceNames = Object.keys(interfaces).sort((a, b) => {
        // Prioritize "Wi-Fi" or "Ethernet" names
        const aPriority = (a.toLowerCase().includes('wi-fi') || a.toLowerCase().includes('ethernet')) ? -1 : 1;
        const bPriority = (b.toLowerCase().includes('wi-fi') || b.toLowerCase().includes('ethernet')) ? -1 : 1;
        return aPriority - bPriority;
    });

    for (const name of sortedInterfaceNames) {
        // Skip obvious virtual adapters if possible, though sorting helps
        if (name.toLowerCase().includes('vmware') || name.toLowerCase().includes('virtual')) continue;

        for (const iface of interfaces[name]) {
            // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                // If multiple remain, maybe prefer 192.168.x.x?
                return iface.address;
            }
        }
    }

    // Fallback: just take the first valid one if we skipped everything (e.g. only virtuals exist)
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

// --------------------------------------------------------------------------
// Activation & Security IPC
// --------------------------------------------------------------------------

ipcMain.handle('get-activation-status', async () => {
    const s = await getStore();
    const licenseKey = s.get('licenseKey');
    const hwid = machineIdSync();

    if (licenseKey) {
        // Attempt to sync with server to get latest password
        try {
            console.log('[License] Syncing with server...');
            const response = await axios.post(LICENSE_API_URL, {
                licenseKey: licenseKey,
                hwid: hwid
            });

            if (response.data && response.data.valid === true) {
                // Update password if changed
                if (response.data.adminPassword) {
                    const currentPwd = s.get('adminPassword');
                    if (currentPwd !== response.data.adminPassword) {
                        console.log('[License] Admin Password updated from server.');
                        s.set('adminPassword', response.data.adminPassword);
                    }
                }
            } else {
                console.warn('[License] Server reported invalid license during sync.');
                // Optionally deactivate? For now, we trust local unless explicit deactivate command.
            }
        } catch (err) {
            console.warn('[License] Sync failed (offline?):', err.message);
        }
    }

    return {
        active: !!licenseKey,
        licenseKey: licenseKey || null,
        hwid: hwid
    };
});

ipcMain.handle('activate-app', async (event, { licenseKey }) => {
    console.log('[Activation] Attempting to activate with key:', licenseKey);
    const hwid = machineIdSync();

    try {
        // Call the license server
        const response = await axios.post(LICENSE_API_URL, {
            licenseKey: licenseKey,
            hwid: hwid
        });

        // The server response should now include { valid: true, adminPassword: "..." }
        if (response.data && response.data.valid === true && response.data.adminPassword) {
            const s = await getStore();
            s.set('licenseKey', licenseKey);
            s.set('adminPassword', response.data.adminPassword);

            console.log('[Activation] Success. Saved to store.');
            return { success: true };
        } else {
            console.warn('[Activation] Server rejected license or missing adminPassword.');
            return { success: false, error: 'Licencia rechazada o datos incompletos.' };
        }
    } catch (err) {
        console.error('[Activation] Error calling server:', err.message);
        return { success: false, error: err.message || 'Error de conexión.' };
    }
});

ipcMain.handle('verify-admin-pin', async (event, pin) => {
    const s = await getStore();
    const saved = s.get('adminPassword');

    console.log('[Security] Verifying Admin PIN');
    console.log(`[Security] Received: "${pin}" (${typeof pin})`);
    console.log(`[Security] Stored:   "${saved}" (${typeof saved})`);

    // Safe comparison: Convert both to strings
    const match = String(saved).trim() === String(pin).trim();
    console.log(`[Security] Match Result: ${match}`);

    if (!match) {
        dialog.showMessageBox({
            type: 'error',
            title: 'Debug Admin Login',
            message: `DEBUG INFO (Eliminar en prod):\n\nRecibido: "${pin}" (Type: ${typeof pin})\nGuardado: "${saved}" (Type: ${typeof saved})\n\n¿Coinciden?: ${match}`
        });
    }

    return match;
});
