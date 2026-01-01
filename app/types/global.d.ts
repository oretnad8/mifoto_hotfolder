export { };

declare global {
    interface Window {
        electron: {
            isElectron: boolean;
            // File System
            getRemovableDrives: () => Promise<any[]>;
            scanDirectory: (path: string) => Promise<any[]>;
            getLocalIp: () => Promise<string>;

            // Activation & Security
            getActivationStatus: () => Promise<{
                active: boolean;
                licenseKey?: string;
                hwid: string;
            }>;
            activateApp: (data: {
                licenseKey: string;
            }) => Promise<{ success: boolean; error?: string }>;
            verifyAdminPin: (pin: string) => Promise<boolean>;

            // Bluetooth
            startBluetooth: () => Promise<{ success: boolean; hostname?: string; error?: string }>;
            stopBluetooth: () => Promise<any>;
            openBluetoothWizard: () => Promise<any>;

            // General
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            on: (channel: string, func: (...args: any[]) => void) => () => void;
        };
    }
}
