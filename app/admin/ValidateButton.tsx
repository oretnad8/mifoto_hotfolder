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
                px-4 py-2 rounded-lg text-sm font-semibold
                transition-all duration-300 transform active:scale-95
                ${loading
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'}
            `}
        >
            <span className="relative z-10">{loading ? 'Procesando...' : 'Validar Pago'}</span>
        </button>
    );
}
