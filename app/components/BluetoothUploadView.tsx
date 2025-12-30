'use client';
import { useState, useEffect } from 'react';
import { Photo } from '../types';
import heic2any from 'heic2any';

interface BluetoothProps {
    onBack: () => void;
    onPhotosReceived: (photos: Photo[]) => void;
}

const BluetoothUploadView = ({ onBack, onPhotosReceived }: BluetoothProps) => {
    const [status, setStatus] = useState('Inicializando Bluetooth...');
    const [hostname, setHostname] = useState<string>('');
    const [receivedPhotos, setReceivedPhotos] = useState<Photo[]>([]);
    const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const startListening = async () => {
            if (!(window as any).electron) {
                setError('Este dispositivo no soporta funciones nativas (No Electron).');
                return;
            }

            try {
                const result = await (window as any).electron.startBluetooth();
                if (isMounted) {
                    if (result.success) {
                        setHostname(result.hostname || 'Kiosco');
                        setStatus('Esperando conexión...');
                    } else {
                        setError(`Error al iniciar Bluetooth: ${result.error}`);
                    }
                }
            } catch (err: any) {
                if (isMounted) setError(`Error inesperado: ${err.message}`);
            }
        };

        // Event Listeners
        const cleanupIncoming = (window as any).electron?.on('bluetooth-file-incoming', (data: any) => {
            if (isMounted) {
                setStatus(`Recibiendo archivo de ${data.name}...`);
                setProgress({ loaded: 0, total: 100 }); // Indeterminate start
            }
        });

        const cleanupProgress = (window as any).electron?.on('bluetooth-progress', (data: any) => {
            if (isMounted && data.total > 0) {
                setProgress({ loaded: data.loaded, total: data.total });
            }
        });

        const cleanupSaved = (window as any).electron?.on('bluetooth-file-saved', async (file: any) => {
            if (isMounted) {
                setStatus('Archivo recibido correctamente. Esperando más...');
                setProgress(null);

                let previewUrl = file.preview;
                let fileObj: File;

                try {
                    // Always fetch the content from local-media to get a real Blob
                    // This fixes the 0kb issue for non-HEIC files
                    const res = await fetch(file.preview);
                    const blob = await res.blob();

                    // Client-side HEIC conversion
                    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                        console.log('Converting Bluetooth HEIC:', file.name);
                        const convertedBlob = await heic2any({
                            blob,
                            toType: 'image/jpeg',
                            quality: 0.8
                        });

                        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                        previewUrl = URL.createObjectURL(finalBlob);

                        fileObj = new File(
                            [finalBlob],
                            file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
                            { type: 'image/jpeg' }
                        );
                    } else {
                        // Standard image (JPG, PNG) - use loaded blob
                        fileObj = new File([blob], file.name, { type: blob.type || 'image/jpeg' });
                    }

                } catch (e) {
                    console.error('Error processing Bluetooth file:', e);
                    // Fallback (might still be 0kb but better than crashing)
                    fileObj = new File([], file.name);
                }

                const newPhoto: Photo = {
                    id: Date.now().toString(),
                    name: fileObj.name,
                    file: fileObj,
                    preview: previewUrl,
                    sourcePath: file.preview
                };

                setReceivedPhotos(prev => [...prev, newPhoto]);
            }
        });

        const cleanupError = (window as any).electron?.on('bluetooth-error', (msg: string) => {
            if (isMounted) setError(msg);
        });

        startListening();

        return () => {
            console.log('[BluetoothUploadView] Unmounting - calling stopBluetooth');
            isMounted = false;
            // Stop litsening on unmount
            if ((window as any).electron) {
                (window as any).electron.stopBluetooth();
                console.log('[BluetoothUploadView] stopBluetooth called');
            } else {
                console.warn('[BluetoothUploadView] window.electron not found during cleanup');
            }
            // Cleanup listeners
            if (cleanupIncoming) cleanupIncoming();
            if (cleanupProgress) cleanupProgress();
            if (cleanupSaved) cleanupSaved();
            if (cleanupError) cleanupError();
        };
    }, []);

    const handleFinish = () => {
        if (receivedPhotos.length > 0) {
            onPhotosReceived(receivedPhotos);
        } else {
            onBack();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6">
            {/* Header */}
            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center max-w-4xl mx-auto w-full pt-8">

                {/* Status Card */}
                <div className="bg-white rounded-2xl shadow-sm p-8 w-full mb-8 text-center border border-gray-100">
                    <div className="mb-4">
                        {error ? (
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="ri-error-warning-line text-4xl text-red-500"></i>
                            </div>
                        ) : (
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 
                                ${status.includes('Recibiendo') ? 'bg-blue-100 animate-pulse' : 'bg-blue-50'}
                            `}>
                                <i className={`text-4xl text-blue-600 
                                    ${status.includes('Recibiendo') ? 'ri-download-cloud-2-line' : 'ri-bluetooth-line'}
                                `}></i>
                            </div>
                        )}
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {error ? 'Ocurrió un error' : (hostname ? `Conéctate a: "${hostname}"` : 'Iniciando...')}
                    </h3>

                    <p className="text-gray-500 mb-6">
                        {error || status}
                    </p>

                    {/* Progress Bar */}
                    {progress && (
                        <div className="w-full max-w-md mx-auto">
                            <div className="flex justify-between text-sm text-gray-500 mb-1">
                                <span>Recibiendo...</span>
                                <span>{Math.round((progress.loaded / progress.total) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {!error && !progress && (
                        <div className="text-sm text-gray-400 bg-gray-50 py-2 px-4 rounded-lg inline-block">
                            <i className="ri-smartphone-line mr-2"></i>
                            Ve a la galería de tu celular → Compartir → Bluetooth
                        </div>
                    )}
                </div>

                {/* Received Photos Grid */}
                {receivedPhotos.length > 0 && (
                    <div className="w-full flex-1 overflow-y-auto mb-6">
                        <h4 className="text-lg font-semibold text-gray-700 mb-4 px-2">
                            Fotos Recibidas ({receivedPhotos.length})
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-2">
                            {receivedPhotos.map((photo) => (
                                <div key={photo.id} className="aspect-square relative group rounded-xl overflow-hidden shadow-sm bg-gray-100">
                                    <img
                                        src={photo.preview}
                                        alt="Recibida"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <i className="ri-check-line text-white text-3xl font-bold"></i>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="w-full py-4 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={handleFinish}
                        disabled={receivedPhotos.length === 0}
                        className={`
                            px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition-all transform
                            ${receivedPhotos.length > 0
                                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-blue-200'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                        `}
                    >
                        {receivedPhotos.length > 0 ? (
                            <>
                                Continuar con {receivedPhotos.length} fotos
                                <i className="ri-arrow-right-line ml-2"></i>
                            </>
                        ) : (
                            'Esperando fotos...'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BluetoothUploadView;
