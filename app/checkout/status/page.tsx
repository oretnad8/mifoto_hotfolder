'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import FinalCode from '../../components/FinalCode';

function StatusContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const paymentId = searchParams.get('payment_id');
    const orderId = searchParams.get('external_reference'); // Get Order ID

    const isApproved = status === 'approved';
    const isPending = status === 'pending' || status === 'in_process';

    const [finalizedOrder, setFinalizedOrder] = useState<any>(null);
    const [isFinalizing, setIsFinalizing] = useState(false);

    useEffect(() => {
        const finalizeOrder = async () => {
            if (isApproved && orderId && !finalizedOrder && !isFinalizing) {
                setIsFinalizing(true);
                try {
                    const response = await fetch('/api/orders/finalize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ orderId }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setFinalizedOrder(data.order);
                    } else {
                        console.error('Failed to finalize order');
                    }
                } catch (error) {
                    console.error('Error finalizing order:', error);
                } finally {
                    setIsFinalizing(false);
                }
            }
        };

        finalizeOrder();
    }, [isApproved, orderId, finalizedOrder, isFinalizing]);

    if (finalizedOrder) {
        return (
            <FinalCode
                orderData={finalizedOrder}
                onNewOrder={() => window.location.href = '/'} // Redirect to home for new order
            />
        );
    }

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
                    {isApproved ? (isFinalizing ? 'Finalizando Pedido...' : '¡Pago Exitoso!') : isPending ? 'Pago Pendiente' : 'Pago Fallido'}
                </h1>

                <p className="text-lg text-[#2D3A52]/70 mb-8">
                    {isApproved
                        ? (isFinalizing ? 'Copiando tus fotos al sistema...' : `Tu pago se ha procesado correctamente. ID: ${paymentId}`)
                        : isPending
                            ? 'Estamos procesando tu pago. Te notificaremos cuando se complete.'
                            : 'Hubo un problema al procesar tu pago. Por favor intenta nuevamente.'
                    }
                </p>

                <div className="space-y-4">
                    {/* Only show "Back" links if NOT finalizing successfully yet */}
                    {!isFinalizing && (
                        <Link
                            href="/"
                            className="block w-full bg-[#D75F1E] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#D75F1E]/90 transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                            Volver al Inicio
                        </Link>
                    )}

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
