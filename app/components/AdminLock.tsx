"use client";

import React, { useState } from "react";

export default function AdminLock({ children }: { children: React.ReactNode }) {
    const [unlocked, setUnlocked] = useState(false);
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);

    // If we are in dev/browser, we might want a bypass or just default behavior.
    // Verification happens against Electron store.

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);

        try {
            if (typeof window !== "undefined" && window.electron) {
                const isValid = await window.electron.verifyAdminPin(pin);
                if (isValid) {
                    setUnlocked(true);
                } else {
                    setError(true);
                }
            } else {
                // Fallback for non-electron dev environment
                if (pin === "admin") {
                    setUnlocked(true);
                } else {
                    setError(true);
                }
            }
        } catch (err) {
            console.error(err);
            setError(true);
        }
    };

    if (unlocked) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4">
                <div className="text-center mb-6">
                    <div className="bg-blue-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Acceso Administrativo</h2>
                    <p className="text-gray-500 text-sm mt-1">Ingrese su contraseña de administrador</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full text-center px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all tracking-widest"
                            placeholder="••••••"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm text-center mb-4">
                            Contraseña incorrecta
                        </p>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-sm"
                    >
                        Desbloquear
                    </button>
                </form>
            </div>
        </div>
    );
}
