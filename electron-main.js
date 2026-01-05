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
    const dev = process.env.NODE_ENV === 'development';

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

    // URL Loading Logic
    // Priority: 
    // 1. Configured Subdomain (https://<subdomain>.localfoto.cl)
    // 2. Localhost HTTPS (https://localhost)

    // We need to get the store synchronously or via the helper. 
    // Since `createWindow` is synchronous usually, we might need to await the store before creating window or just get it here.
    // However, `getStore` is async. 
    // Hack: We called `await getStore()` in app.whenReady(), so `store` variable should be populated globally.

    let dbSubdomain = store ? store.get('subdomain') : null;
    let targetUrl = 'https://localhost'; // Default fallback

    if (dbSubdomain) {
        targetUrl = `https://${dbSubdomain}.localfoto.cl`;
        console.log(`[Window] Loading configured subdomain: ${targetUrl}`);
    } else if (process.env.NEXT_PUBLIC_HOST) {
        // Fallback from ENV if not in store
        targetUrl = `https://${process.env.NEXT_PUBLIC_HOST}`;
        console.log(`[Window] Loading from ENV host: ${targetUrl}`);
    } else {
        console.log(`[Window] No subdomain configured. Loading local dev: ${targetUrl}`);
    }

    if (dev) {
        // In dev, we might still want to load the remote URL if that's what we are testing, 
        // OR we might want localhost. 
        // The prompt says: "Si tenemos subdominio... la URL a cargar debe ser https://test.localfoto.cl"
        // It implies this logic applies always.

        // However, invalid SSL on localhost might trigger warnings.
        mainWindow.loadURL(targetUrl).catch(err => {
            console.error(`[Window] Failed to load ${targetUrl}:`, err);
            // Fallback to localhost if remote fails?
            if (targetUrl !== 'https://localhost') {
                console.log('[Window] Retrying with https://localhost...');
                mainWindow.loadURL('https://localhost');
            }
        });

        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadURL(targetUrl).catch(err => {
            console.error(`[Window] Failed to load ${targetUrl}:`, err);
            if (targetUrl !== 'https://localhost') {
                console.log('[Window] Retrying with https://localhost...');
                mainWindow.loadURL('https://localhost');
            }
        });
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

// Ignore certificate errors for self-signed certs (e.g. localhost)
// specific for "ERR_CERT_COMMON_NAME_INVALID" and others during dev/test
app.commandLine.appendSwitch('ignore-certificate-errors');

app.whenReady().then(async () => {
    // 1. Inicializar Store
    await getStore();

    // 2. Verificación Previa (Ping): Verificar si existe una licenseKey
    const licenseKey = store.get('licenseKey');

    if (licenseKey) {
        // 3. Actualizar IP: Intentar notificar al servidor la nueva IP
        try {
            console.log('[Startup] License found. Attempting back-end IP sync...');
            const hwid = machineIdSync();
            const localIp = getLocalIpAddress();

            // Timeout corto (3s) para no bloquear el arranque si no hay internet
            const response = await axios.post(LICENSE_API_URL, {
                licenseKey: licenseKey,
                hwid: hwid,
                localIp: localIp
            }, { timeout: 3000 });

            if (response.data && response.data.valid === true) {
                console.log('[Startup] IP Sync successful.');

                // Actualizar datos del store si el servidor devuelve nuevos valores
                if (response.data.subdomain) store.set('subdomain', response.data.subdomain);
                if (response.data.adminPassword) store.set('adminPassword', response.data.adminPassword);
                if (response.data.mpAccessToken) store.set('mpAccessToken', response.data.mpAccessToken);
                
                // Actualizar configuración visual/extra
                if (response.data.clientLogoUrl) store.set('clientLogoUrl', response.data.clientLogoUrl);
                if (response.data.welcomeText) store.set('welcomeText', response.data.welcomeText);
                if (response.data.validatorPassword) store.set('validatorPassword', response.data.validatorPassword);
                if (response.data.themeColor) store.set('themeColor', response.data.themeColor);
            }
        } catch (err) {
            // Si falla (timeout o error de red), solo logueamos y continuamos
            console.warn('[Startup] IP Sync failed or timed out:', err.message);
        }
    }

    // 4. Abrir Ventana
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
        frame: false, // Frameless window as requested
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

    // Check URL on logic
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
            return true; // Handled
        }
        return false;
    };

    // 1. Successful Navigation
    paymentWin.webContents.on('did-navigate', (event, url) => handleUrl(url));

    // 2. Redirects (30x)
    paymentWin.webContents.on('will-redirect', (event, url) => {
        if (handleUrl(url)) event.preventDefault();
    });

    // 3. User Navigation (clicking link or script)
    paymentWin.webContents.on('will-navigate', (event, url) => {
        if (handleUrl(url)) event.preventDefault();
    });

    // 4. Failed Loads (like our dummy domain ERR_NAME_NOT_RESOLVED)
    paymentWin.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.log('[Payment] Page failed to load:', validatedURL, errorDescription);
        handleUrl(validatedURL);
    });

    // Optional: Handle user closing the window manually
    paymentWin.on('closed', () => {
        console.log('[Payment] Modal closed.');
        // We might want to notify the main window that it was closed without explicit success
        // but often 'pending' state in UI is enough until explicit success/fail.
    });

    return { success: true };
});

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

    let extraConfig = {
        clientLogoUrl: s.get('clientLogoUrl'),
        welcomeText: s.get('welcomeText'),
        validatorPassword: s.get('validatorPassword'),
        themeColor: s.get('themeColor')
    };

    if (licenseKey) {
        // Attempt to sync with server to get latest password
        try {
            console.log('[License] Syncing with server...');
            const localIp = getLocalIpAddress();
            const response = await axios.post(LICENSE_API_URL, {
                licenseKey: licenseKey,
                hwid: hwid,
                localIp: localIp
            }, { timeout: 5000 });

            if (response.data && response.data.valid === true) {
                console.log('[License] FULL SERVER RESPONSE:', JSON.stringify(response.data, null, 2));

                // Update password if changed
                if (response.data.adminPassword) {
                    const currentPwd = s.get('adminPassword');
                    if (currentPwd !== response.data.adminPassword) {
                        console.log('[License] Admin Password updated from server.');
                        s.set('adminPassword', response.data.adminPassword);
                    }
                }
                // Save MP Access Token if provided
                if (response.data.mpAccessToken) {
                    const currentToken = s.get('mpAccessToken');
                    if (currentToken !== response.data.mpAccessToken) {
                        console.log('[License] New Mercado Pago Token received and saved.');
                        s.set('mpAccessToken', response.data.mpAccessToken);
                    }
                }

                // Save Subdomain if provided
                if (response.data.subdomain) {
                    const currentSub = s.get('subdomain');
                    if (currentSub !== response.data.subdomain) {
                        console.log('[License] Subdomain updated from server.');
                        s.set('subdomain', response.data.subdomain);
                    }
                }

                // Update and Save Extra Config
                extraConfig = {
                    clientLogoUrl: response.data.clientLogoUrl,
                    welcomeText: response.data.welcomeText,
                    validatorPassword: response.data.validatorPassword,
                    themeColor: response.data.themeColor
                };

                // Persist extra config to store for offline usage
                if (extraConfig.clientLogoUrl !== undefined) s.set('clientLogoUrl', extraConfig.clientLogoUrl);
                if (extraConfig.welcomeText !== undefined) s.set('welcomeText', extraConfig.welcomeText);
                if (extraConfig.validatorPassword !== undefined) s.set('validatorPassword', extraConfig.validatorPassword);
                if (extraConfig.themeColor !== undefined) s.set('themeColor', extraConfig.themeColor);

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
        hwid: hwid,
        ...extraConfig
    };
});

ipcMain.handle('activate-app', async (event, { licenseKey }) => {
    console.log('[Activation] Attempting to activate with key:', licenseKey);
    const hwid = machineIdSync();

    try {
        // Call the license server
        const localIp = getLocalIpAddress();
        const response = await axios.post(LICENSE_API_URL, {
            licenseKey: licenseKey,
            hwid: hwid,
            localIp: localIp
        }, { timeout: 8000 });

        // The server response should now include { valid: true, adminPassword: "..." }
        if (response.data && response.data.valid === true && response.data.adminPassword) {
            console.log('[Activation] FULL SERVER RESPONSE:', JSON.stringify(response.data, null, 2));

            const s = await getStore();
            s.set('licenseKey', licenseKey);
            s.set('adminPassword', response.data.adminPassword);

            if (response.data.mpAccessToken) {
                s.set('mpAccessToken', response.data.mpAccessToken);
                console.log('[Activation] MP Token saved.');
            }

            if (response.data.subdomain) {
                s.set('subdomain', response.data.subdomain);
                console.log('[Activation] Subdomain saved.');
            }

            console.log('[Activation] Success. Saved to store.');

            return {
                success: true,
                clientLogoUrl: response.data.clientLogoUrl,
                welcomeText: response.data.welcomeText,
                validatorPassword: response.data.validatorPassword,
                themeColor: response.data.themeColor
            };
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
