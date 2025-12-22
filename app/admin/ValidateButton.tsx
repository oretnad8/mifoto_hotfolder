'use client';

import { useState } from 'react';
import { validateOrderAction } from './actions';

export default function ValidateButton({ orderId }: { orderId: string }) {
    const [loading, setLoading] = useState(false);

    const handleValidate = async () => {
        // No token prompt needed! Middleware protects the page access.
        if (!confirm('¿Validar orden y mover archivos?')) return;

        setLoading(true);
        try {
            const result = await validateOrderAction(orderId);
            if (result.success) {
                // Auto-refresh handled by revalidatePath in action
                alert('Orden validada correctamente');
            } else {
                alert('Error al validar: ' + (result.error || 'Desconocido'));
            }
        } catch (err) {
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleValidate}
            disabled={loading}
            className={`
                relative overflow-hidden group
                px-6 py-2 rounded-xl text-sm font-bold
                transition-all duration-300 transform active:scale-95 shadow-lg
                ${loading
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#D75F1E] hover:bg-[#D75F1E]/90 text-white hover:scale-105'
                }
            `}
        >
            <span className="relative z-10 flex items-center gap-2">
                {loading ? 'Procesando...' : (
                    <>
                        Validar Pago
                        <i className="ri-check-line"></i>
                    </>
                )}
            </span>
        </button>
    );
}
