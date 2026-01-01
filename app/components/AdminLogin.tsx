"use client";

import React, { useState } from "react";

interface AdminLoginProps {
    onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(false);

        try {
            const res = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                onLogin();
            } else {
                console.error('Login failed:', data.error);
                setError(true);
            }
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-sm w-full border border-gray-100">
                <div className="bg-[#2D3A52] p-6 text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white">Acceso Administrativo</h2>
                    <p className="text-blue-200 text-sm mt-1">Ingrese su contraseña</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 outline-none transition-all text-center text-lg tracking-widest text-[#2D3A52] ${error
                                    ? "border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50"
                                    : "border-gray-300 focus:ring-blue-100 focus:border-[#2D3A52]"
                                    }`}
                                placeholder="••••••"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError(false);
                                }}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
                                Contraseña incorrecta
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#D75F1E] hover:bg-[#c0551a] text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md flex justify-center items-center"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : "Ingresar"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
