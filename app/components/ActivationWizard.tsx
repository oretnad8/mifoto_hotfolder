"use client";

import React, { useState, useEffect } from "react";

import { saveValidationSettings } from "@/app/actions/settings";

export default function ActivationWizard() {
    const [licenseKey, setLicenseKey] = useState("");
    const [hwid, setHwid] = useState("Cargando...");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Get HWID for display
        if (typeof window !== "undefined" && window.electron) {
            window.electron.getActivationStatus().then(async (status: any) => {
                if (status.hwid) setHwid(status.hwid);
                // If active and we have extra config, sync it
                if (status.active) {
                    await saveValidationSettings({
                        clientLogoUrl: status.clientLogoUrl,
                        welcomeText: status.welcomeText,
                        validatorPassword: status.validatorPassword,
                        brandingThemeColor: status.themeColor
                    });
                }
            });
        }
    }, []);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!window.electron) {
                throw new Error("Electron API not found");
            }

            const result: any = await window.electron.activateApp({
                licenseKey
            });

            if (result.success) {
                console.log(">>>>>>>> [ActivationWizard] Activation SUCCESS. Data from Electron:", result);
                // Save settings locally
                await saveValidationSettings({
                    clientLogoUrl: result.clientLogoUrl,
                    welcomeText: result.welcomeText,
                    validatorPassword: result.validatorPassword,
                    brandingThemeColor: result.themeColor
                });

                // Success! Reload or notify parent.
                // Prompt says "recarga la página o oculta el modal". Reload is safest to ensure fresh state.
                window.location.reload();
            } else {
                setError(result.error || "Error desconocido al activar.");
            }
        } catch (err: any) {
            setError(err.message || "Error de comunicación.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                <div className="bg-blue-600 p-6 text-center">
                    <h2 className="text-2xl font-bold text-white">Activación de Localfoto</h2>
                    <p className="text-blue-100 text-sm mt-1">Configuración Inicial</p>
                </div>

                <div className="p-8">
                    <div className="mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                        <span className="block text-xs text-gray-500 uppercase tracking-wide font-semibold">
                            ID de Dispositivo (HWID)
                        </span>
                        <code className="block text-sm font-mono text-gray-800 mt-1 select-all">
                            {hwid}
                        </code>
                    </div>

                    <form onSubmit={handleActivate} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Clave de Licencia
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400 text-gray-900"
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors shadow-sm ${loading
                                ? "bg-blue-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200"
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Verificando...
                                </span>
                            ) : (
                                "Activar Kiosco"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
