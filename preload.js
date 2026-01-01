const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    // New specific APIs
    getRemovableDrives: () => ipcRenderer.invoke('get-removable-drives'),
    scanDirectory: (path) => ipcRenderer.invoke('scan-directory', path),
    getLocalIp: () => ipcRenderer.invoke('get-local-ip'),

    // Activation & Security
    getActivationStatus: () => ipcRenderer.invoke('get-activation-status'),
    activateApp: (data) => ipcRenderer.invoke('activate-app', data),
    verifyAdminPin: (pin) => ipcRenderer.invoke('verify-admin-pin', pin),

    // Bluetooth Bridge
    startBluetooth: () => ipcRenderer.invoke('bluetooth-start-listening'),
    stopBluetooth: () => ipcRenderer.invoke('bluetooth-stop-listening'),
    openBluetoothWizard: () => ipcRenderer.invoke('bluetooth-open-wizard'),

    // Backward compatibility / Generic
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, func) => {
        const subscription = (event, ...args) => func(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    }
});
