const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let bluetoothServerProcess = null;

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

app.whenReady().then(() => {
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
ipcMain.handle('get-local-ip', async () => { return '127.0.0.1'; });
