
'use client';

import { useState, useEffect } from 'react';
import { Order } from '../types';

interface FinalCodeProps {
  orderData: Order;
  onNewOrder: () => void;
}

const FinalCode = ({ orderData, onNewOrder }: FinalCodeProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white px-8 py-12">
      <div className="max-w-4xl mx-auto text-center">
        {/* Header de éxito limpio */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#2D3A52] mb-4">¡Gracias por tu Compra!</h1>
          <p className="text-xl text-[#2D3A52]/70">Tu pago ha sido procesado exitosamente</p>
        </div>

        {/* Código de orden principal con ticket verde discreto */}
        <div className="bg-gradient-to-br from-[#CEDFE7] to-[#FCF4F3] rounded-3xl p-12 mb-8 shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-[#2D3A52]">Código de Orden</h2>
            {/* Ticket verde discreto */}
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <i className="ri-check-line text-white text-sm"></i>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 mb-8 shadow-lg">
            <div className="text-6xl font-bold text-[#D75F1E] mb-4 font-mono tracking-wider">
              {orderData.id}
            </div>
          </div>

          {/* Instrucciones importantes arriba */}
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <i className="ri-information-line text-green-600 text-2xl mt-1"></i>
              <div className="text-left">
                <h3 className="text-lg font-bold text-green-800 mb-3">¡Tu pedido está confirmado!</h3>
                <ul className="space-y-2 text-sm text-green-700">
                  <li className="flex items-start gap-2">
                    <i className="ri-arrow-right-line mt-0.5"></i>
                    <span>Tu pago ha sido procesado exitosamente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-arrow-right-line mt-0.5"></i>
                    <span>Espera frente al equipo para recoger tus fotos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-arrow-right-line mt-0.5"></i>
                    <span>Tus fotos estarán listas dentro de minutos!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-arrow-right-line mt-0.5"></i>
                    <span>Guarda este código hasta recoger tu pedido</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Detalles del pedido */}
          <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6 text-left">
            <h3 className="text-xl font-bold text-[#2D3A52] mb-6 text-center">Detalles del Pedido</h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/50">
                <span className="text-[#2D3A52]/70">Cliente:</span>
                <span className="font-semibold text-[#2D3A52]">{orderData.customerName}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/50">
                <span className="text-[#2D3A52]/70">Total de Fotos:</span>
                <span className="font-semibold text-[#2D3A52]">{orderData.totalPhotos}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/50">
                <span className="text-[#2D3A52]/70">Productos:</span>
                <span className="font-semibold text-[#2D3A52]">{orderData.items.length}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/50">
                <span className="text-[#2D3A52]/70">Estado:</span>
                <span className="font-semibold text-green-600">PAGADO</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/50">
                <span className="text-[#2D3A52]/70">Fecha:</span>
                <span className="font-semibold text-[#2D3A52] text-sm">
                  {formatDate(orderData.createdAt)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-lg font-semibold text-[#2D3A52]">Total Pagado:</span>
                <span className="text-2xl font-bold text-[#D75F1E]">${orderData.total.toFixed(0)}</span>
              </div>
            </div>

            {/* Desglose de productos */}
            <div className="mt-6 pt-4 border-t border-white/50">
              <h4 className="font-semibold text-[#2D3A52] mb-3">Productos:</h4>
              <div className="space-y-2">
                {orderData.items.map((item, index) => (
                  <div key={index} className="bg-white/60 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-[#2D3A52] text-sm">{item.size.name}</p>
                        <p className="text-xs text-[#2D3A52]/70">
                          {item.totalPhotos} impresiones • {item.size.dimensions}
                        </p>
                      </div>
                      <span className="font-bold text-[#D75F1E]">${item.subtotal.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Información de recogida */}
          <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6 text-left">
            <h3 className="text-xl font-bold text-[#2D3A52] mb-6 text-center">Información de Recogida</h3>

            <div className="bg-white/80 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <i className="ri-map-pin-fill text-[#D75F1E] text-xl mt-1"></i>
                <div>
                  <h4 className="font-semibold text-[#2D3A52] mb-1">{orderData.kiosk.name}</h4>
                  <p className="text-sm text-[#2D3A52]/70">{orderData.kiosk.address}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                <i className="ri-time-line text-[#D75F1E] text-xl"></i>
                <div>
                  <p className="font-medium text-[#2D3A52]">Tiempo de preparación</p>
                  <p className="text-sm text-[#2D3A52]/70">5-10 minutos aproximadamente</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                <i className="ri-check-double-line text-[#D75F1E] text-xl"></i>
                <div>
                  <p className="font-medium text-[#2D3A52]">Estado del pago</p>
                  <p className="text-sm text-green-600 font-semibold">Confirmado y procesado</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                <i className="ri-id-card-line text-[#D75F1E] text-xl"></i>
                <div>
                  <p className="font-medium text-[#2D3A52]">Para recoger</p>
                  <p className="text-sm text-[#2D3A52]/70">Muestra tu código de orden</p>
                </div>
              </div>
            </div>

            {/* Reloj en tiempo real */}
            <div className="mt-6 p-4 bg-white/60 rounded-lg text-center" suppressHydrationWarning={true}>
              <p className="text-sm text-[#2D3A52]/70 mb-1">Hora actual</p>
              <p className="text-2xl font-bold text-[#2D3A52] font-mono">
                {formatTime(currentTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Botón para nuevo pedido */}
        <div className="text-center">
          <button
            onClick={onNewOrder}
            className="bg-[#D75F1E] text-white px-12 py-4 rounded-xl font-bold text-lg hover:bg-[#D75F1E]/90 transition-all duration-200 transform hover:scale-105 shadow-lg whitespace-nowrap"
          >
            <i className="ri-add-line mr-2"></i>
            Hacer Nuevo Pedido
          </button>

          <p className="text-sm text-[#2D3A52]/70 mt-4">
            ¿Necesitas imprimir más fotos? Haz un nuevo pedido cuando quieras
          </p>
        </div>

        {/* Footer limpio sin logos */}
        <div className="mt-16 pt-8 border-t border-gray-100">
          <p className="text-sm text-[#2D3A52]/60">
            Gracias por usar nuestro servicio de impresión fotográfica
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinalCode;
