'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function StatusContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const paymentId = searchParams.get('payment_id');

    const isApproved = status === 'approved';
    const isPending = status === 'pending' || status === 'in_process';

    return (
        <div className="min-h-screen bg-white px-8 py-12 flex items-center justify-center">
            <div className="max-w-md w-full text-center">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 ${isApproved ? 'bg-green-100' : isPending ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                    <i className={`text-4xl ${isApproved
                            ? 'ri-checkbox-circle-line text-green-600'
                            : isPending
                                ? 'ri-time-line text-yellow-600'
                                : 'ri-close-circle-line text-red-600'
                        }`}></i>
                </div>

                <h1 className="text-3xl font-bold text-[#2D3A52] mb-4">
                    {isApproved ? '¡Pago Exitoso!' : isPending ? 'Pago Pendiente' : 'Pago Fallido'}
                </h1>

                <p className="text-lg text-[#2D3A52]/70 mb-8">
                    {isApproved
                        ? `Tu pago se ha procesado correctamente. ID: ${paymentId}`
                        : isPending
                            ? 'Estamos procesando tu pago. Te notificaremos cuando se complete.'
                            : 'Hubo un problema al procesar tu pago. Por favor intenta nuevamente.'
                    }
                </p>

                <div className="space-y-4">
                    <Link
                        href="/"
                        className="block w-full bg-[#D75F1E] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#D75F1E]/90 transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                        Volver al Inicio
                    </Link>

                    {!isApproved && (
                        <Link
                            href="/cart"
                            className="block w-full bg-white text-[#2D3A52] border-2 border-[#2D3A52]/10 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all duration-200"
                        >
                            Intentar Nuevamente
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StatusPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <StatusContent />
        </Suspense>
    );
}
