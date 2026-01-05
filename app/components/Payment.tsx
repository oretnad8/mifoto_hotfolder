'use client';

import { useState, useEffect } from 'react';
import { Order } from '../types';

interface PaymentProps {
  orderData: Order;
  onPaymentSuccess: (order: Order) => void;
  onBack: () => void;
}

const Payment = ({ orderData, onPaymentSuccess, onBack }: PaymentProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Listen for payment results from Electron Main process
  useEffect(() => {
    // Check if running in Electron and if API exists
    if (typeof window !== 'undefined' && (window as any).electron && (window as any).electron.onPaymentResult) {
      console.log('Registering payment result listener...');
      const unsubscribe = (window as any).electron.onPaymentResult((result: any) => {
        console.log('Payment Result Received:', result);

        if (result.type === 'success') {
          // Payment approved
          const paidOrder = {
            ...orderData,
            status: 'paid',
            paidAt: new Date(),
            paymentMethod: 'mercadopago'
          };
          onPaymentSuccess(paidOrder);
        } else {
          // Failure or error
          setIsProcessing(false);
          alert('El pago no se pudo completar o fue cancelado.');
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [onPaymentSuccess, orderData]);

  // Duplicate of upload logic from page.tsx to handle mobile redirects
  const uploadPhotos = async (items: any[]) => {
    let globalSequence = 1;
    const rawName = orderData.customerName || 'cliente';
    const clientName = rawName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const now = new Date();
    const timestamp = `${now.getHours()}${now.getMinutes().toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}${now.getMonth() + 1}${now.getFullYear()}`;

    const updatedItems = JSON.parse(JSON.stringify(items));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const formData = new FormData();
      formData.append('sizeId', item.size.id);

      const rawPhotos = item.photos || [];
      for (const photo of rawPhotos) {
        if (photo.file) {
          formData.append('photos', photo.file);
          const seqStr = globalSequence.toString().padStart(3, '0');
          const customName = `${clientName}_${timestamp}_${seqStr}.jpg`;
          formData.append('customNames', customName);
          globalSequence++;
        }
      }

      if (formData.has('photos')) {
        const response = await fetch('/api/upload-photos', { method: 'POST', body: formData });
        if (response.ok) {
          const result = await response.json();
          if (result.files) {
            updatedItems[i].photos = updatedItems[i].photos.map((p: any) => {
              const serverFile = result.files.find((f: any) => f.name === p.name);
              return { ...p, fileName: serverFile ? serverFile.fileName : p.name, file: undefined };
            });
          }
        }
      }
    }
    return updatedItems;
  };

  const createPendingOrder = async (updatedItems: any[]) => {
    const finalOrder = {
      client: { name: orderData.customerName, kiosk: orderData.kiosk },
      items: updatedItems,
      total: orderData.total,
      paymentMethod: 'mercadopago',
      status: 'pending_payment' // Initial status
    };

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalOrder)
    });

    if (!response.ok) throw new Error('Failed to create pending order');
    return await response.json();
  };

  const handleMercadoPagoPayment = async () => {
    setIsProcessing(true);
    try {
      const isElectron = typeof window !== 'undefined' && (window as any).electron;

      let currentOrderId = orderData.id;

      // Mobile Flow: Persist data before redirect
      if (!isElectron) {
        console.log('[Mobile] Uploading photos and creating pending order...');
        const updatedItems = await uploadPhotos(orderData.items);
        const createdOrder = await createPendingOrder(updatedItems);
        currentOrderId = createdOrder.orderId; // Use the DB ID
        console.log('[Mobile] Pending order created:', currentOrderId);
      }

      const response = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isElectron: !!isElectron, // Flag to determine URL strategy
          external_reference: currentOrderId, // Attach ID
          items: orderData.items.map(item => ({
            id: item.size.id,
            title: `Impresión ${item.size.name} (${item.size.dimensions})`,
            quantity: item.totalPhotos,
            unit_price: item.subtotal / item.totalPhotos,
          })),
          metadata: {
            orderId: currentOrderId,
            customerName: orderData.customerName,
          }
        }),
      });

      const data = await response.json();

      // Use production init_point by default. Fallback to sandbox only if prod is missing.
      const redirectUrl = data.init_point || data.sandbox_init_point;

      if (redirectUrl) {
        console.log('Opening Mercado Pago Modal:', redirectUrl);

        // Use Electron Native Modal if available
        if (typeof window !== 'undefined' && (window as any).electron && (window as any).electron.openPaymentModal) {
          (window as any).electron.openPaymentModal(redirectUrl);
        } else {
          // Fallback for web / dev without electron
          // Photos are already uploaded and order created. Redirecting...
          console.warn('Electron API not found, falling back to window.location');
          window.location.href = redirectUrl;
        }

      } else {
        console.error('No init_point returned', data);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error creating preference:', error);
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (paymentMethod === 'mercadopago') {
      await handleMercadoPagoPayment();
      return;
    }

    setIsProcessing(true);

    // Simular procesamiento de pago
    setTimeout(() => {
      setIsProcessing(false);
      const paidOrder = {
        ...orderData,
        status: paymentMethod === 'cash' ? 'pending' : 'paid',
        paidAt: paymentMethod === 'cash' ? undefined : new Date(),
        paymentMethod: paymentMethod
      };
      onPaymentSuccess(paidOrder);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-white px-8 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#2D3A52] hover:text-brand-600 transition-colors duration-200 whitespace-nowrap"
            disabled={isProcessing}
          >
            <i className="ri-arrow-left-line text-xl"></i>
            <span className="text-lg font-medium">Volver</span>
          </button>

          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-[#2D3A52] mb-2">Pago Seguro</h1>
            <p className="text-lg text-[#2D3A52]/70">Completa tu compra de forma segura</p>
          </div>

          <div className="w-24"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario de pago */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-[#2D3A52] mb-8">Método de Pago</h3>

              {/* Selector de método de pago */}
              <div className="space-y-4 mb-8">
                <div
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'cash'
                    ? 'bg-white ring-4 ring-brand-500 shadow-lg'
                    : 'bg-white/80 hover:bg-white hover:shadow-md'
                    }`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cash'
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-gray-300'
                      }`}>
                      {paymentMethod === 'cash' && (
                        <i className="ri-check-line text-white text-sm"></i>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <i className="ri-store-2-line text-2xl text-[#2D3A52]"></i>
                      <div>
                        <h4 className="font-semibold text-[#2D3A52]">Pagar en Caja</h4>
                        <p className="text-sm text-[#2D3A52]/70">Efectivo o Tarjeta presencial</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'mercadopago'
                    ? 'bg-white ring-4 ring-brand-500 shadow-lg'
                    : 'bg-white/80 hover:bg-white hover:shadow-md'
                    }`}
                  onClick={() => setPaymentMethod('mercadopago')}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'mercadopago'
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-gray-300'
                      }`}>
                      {paymentMethod === 'mercadopago' && (
                        <i className="ri-check-line text-white text-sm"></i>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <i className="ri-hand-coin-line text-2xl text-[#2D3A52]"></i>
                      <div>
                        <h4 className="font-semibold text-[#2D3A52]">Mercado Pago</h4>
                        <p className="text-sm text-[#2D3A52]/70">Tarjetas, Saldo Mercado Pago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información de Pagar en Caja */}
              {paymentMethod === 'cash' && (
                <div className="bg-white/60 rounded-xl p-6">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-store-2-line text-brand-600 text-2xl"></i>
                    </div>
                    <h4 className="font-semibold text-[#2D3A52] mb-2">Instrucciones de Pago</h4>
                    <p className="text-sm text-[#2D3A52]/70">Sigue estos pasos para completar tu orden:</p>
                  </div>

                  <div className="space-y-4 text-sm mt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-gray-200 font-bold text-brand-600">
                        1
                      </div>
                      <p className="text-[#2D3A52] pt-1">
                        Dirígete a la caja y menciona que deseas pagar tu orden actual.
                      </p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-gray-200 font-bold text-brand-600">
                        2
                      </div>
                      <p className="text-[#2D3A52] pt-1">
                        Realiza el pago con <span className="font-bold">Efectivo</span> o <span className="font-bold">Tarjeta</span>.
                      </p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-gray-200 font-bold text-brand-600">
                        3
                      </div>
                      <p className="text-[#2D3A52] pt-1">
                        El operador validará tu pago y la impresión comenzará automáticamente.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botón de pago */}
              <div className="mt-8">
                <button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full bg-brand-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-600 transition-all duration-200 transform hover:scale-105 shadow-lg whitespace-nowrap disabled:opacity-50 disabled:transform-none"
                >
                  {isProcessing ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Procesando Pago...
                    </>
                  ) : (
                    <>
                      <i className="ri-secure-payment-line mr-2"></i>
                      Pagar ${orderData.total.toFixed(0)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Resumen del pedido */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6 sticky top-8">
              <h3 className="text-xl font-bold text-[#2D3A52] mb-6">Resumen de Compra</h3>

              {/* Cliente */}
              <div className="bg-white/80 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-[#2D3A52] mb-2">Cliente</h4>
                <p className="text-sm text-[#2D3A52]">{orderData.customerName}</p>
                <p className="text-xs text-[#2D3A52]/70">Código: {orderData.id}</p>
              </div>

              {/* Productos */}
              <div className="space-y-3 mb-6">
                {orderData.items.map((item, index) => (
                  <div key={index} className="bg-white/80 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-[#2D3A52] text-sm">{item.size.name}</p>
                        <p className="text-xs text-[#2D3A52]/70">
                          {item.totalPhotos} impresiones • {item.size.dimensions}
                        </p>
                      </div>
                      <span className="font-bold text-brand-600">${item.subtotal.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t border-white/50 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#2D3A52]/70">Total Fotos:</span>
                  <span className="font-bold text-[#2D3A52]">{orderData.totalPhotos}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-[#2D3A52]">Total:</span>
                  <span className="text-2xl font-bold text-brand-500">${orderData.total.toFixed(0)}</span>
                </div>
              </div>

              {/* Seguridad */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-shield-check-line text-green-600"></i>
                  <span className="text-sm font-medium text-green-800">Pago Seguro</span>
                </div>
                <p className="text-xs text-green-700">
                  Tu información está protegida con encriptación SSL de 256 bits
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de procesamiento */}
        {isProcessing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 text-center max-w-md mx-4">
              <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <i className="ri-loader-4-line text-white text-2xl animate-spin"></i>
              </div>
              <h3 className="text-xl font-bold text-[#2D3A52] mb-4">Procesando Pago</h3>
              <p className="text-[#2D3A52]/70 mb-4">
                Por favor espera mientras validamos tu pago...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-brand-500 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payment;