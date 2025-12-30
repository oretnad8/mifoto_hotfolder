const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    // New specific APIs
    getRemovableDrives: () => ipcRenderer.invoke('get-removable-drives'),
    scanDirectory: (path) => ipcRenderer.invoke('scan-directory', path),
    getLocalIp: () => ipcRenderer.invoke('get-local-ip'),

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
