
'use client';

import { useState } from 'react';
import { Order, CartItem } from '../types';

interface ConfirmationProps {
  cartItems: CartItem[];
  onConfirm: (order: Order) => void;
  onBack: () => void;
}

const Confirmation = ({ cartItems, onConfirm, onBack }: ConfirmationProps) => {
  const [customerName, setCustomerName] = useState('');
  const [errors, setErrors] = useState<any>({});

  const selectedKiosk = {
    id: 'main-kiosk',
    name: 'Kiosco Local',
    address: 'Impresión Inmediata'
  };

  const getTotalAmount = () => {
    return cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const getTotalPhotos = () => {
    return cartItems.reduce((sum, item) => sum + item.totalPhotos, 0);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!customerName.trim()) {
      newErrors.name = 'Ingresa tu nombre completo';
    } else if (customerName.trim().length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (validateForm()) {
      const orderData = {
        id: generateOrderCode(),
        customerName: customerName.trim(),
        kiosk: selectedKiosk,
        items: cartItems,
        total: getTotalAmount(),
        totalPhotos: getTotalPhotos(),
        createdAt: new Date(),
        status: 'pending_payment'
      };
      onConfirm(orderData);
    }
  };

  const generateOrderCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    const letter1 = letters[Math.floor(Math.random() * letters.length)];
    const letter2 = letters[Math.floor(Math.random() * letters.length)];
    const num1 = numbers[Math.floor(Math.random() * numbers.length)];
    const num2 = numbers[Math.floor(Math.random() * numbers.length)];
    const letter3 = letters[Math.floor(Math.random() * letters.length)];
    const letter4 = letters[Math.floor(Math.random() * letters.length)];

    return `${letter1}${letter2}${num1}${num2}${letter3}${letter4}`;
  };

  return (
    <div className="min-h-screen bg-white px-8 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#2D3A52] hover:text-[#D75F1E] transition-colors duration-200 whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-xl"></i>
            <span className="text-lg font-medium">Volver</span>
          </button>

          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-[#2D3A52] mb-2">Confirmación</h1>
            <p className="text-lg text-[#2D3A52]/70">Completa tu información para continuar al pago</p>
          </div>

          <div className="w-24"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario */}
          <div className="lg:col-span-2 space-y-8">
            {/* Kiosco seleccionado (fijo) */}
            <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6">
              <h3 className="text-xl font-bold text-[#2D3A52] mb-6">Tu Kiosco</h3>

              <div className="p-4 bg-white rounded-xl">
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-[#D75F1E] rounded-full flex items-center justify-center mt-1">
                    <i className="ri-check-line text-white text-sm"></i>
                  </div>

                  <div className="flex-1">
                    <h4 className="font-semibold text-[#2D3A52] mb-1">{selectedKiosk.name}</h4>
                    <p className="text-sm text-[#2D3A52]/70 flex items-center gap-1">
                      <i className="ri-map-pin-line"></i>
                      {selectedKiosk.address}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Información del cliente */}
            <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6">
              <h3 className="text-xl font-bold text-[#2D3A52] mb-6">Información del Cliente</h3>

              <div>
                <label className="block text-sm font-medium text-[#2D3A52] mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ingresa tu nombre completo"
                  className={`w-full px-4 py-3 bg-white rounded-xl border-2 transition-colors duration-200 text-sm ${errors.name
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-transparent focus:border-[#D75F1E]'
                    } focus:outline-none`}
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <i className="ri-error-warning-line"></i>
                    {errors.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Resumen del pedido */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6 sticky top-8">
              <h3 className="text-xl font-bold text-[#2D3A52] mb-6">Resumen del Pedido</h3>

              {/* Productos */}
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="bg-white/80 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-[#2D3A52] text-sm">{item.size.name}</h4>
                      <span className="font-bold text-[#D75F1E]">${item.subtotal.toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-[#2D3A52]/70">
                      {item.totalPhotos} impresiones • {item.size.dimensions}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="border-t border-white/50 pt-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#2D3A52]/70">Total Fotos:</span>
                  <span className="font-bold text-[#2D3A52]">{getTotalPhotos()}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-[#2D3A52]">Total a Pagar:</span>
                  <span className="text-2xl font-bold text-[#D75F1E]">${getTotalAmount().toFixed(0)}</span>
                </div>
              </div>

              {/* Botón proceder al pago */}
              <button
                onClick={handleConfirm}
                className="w-full bg-[#D75F1E] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#D75F1E]/90 transition-all duration-200 transform hover:scale-105 shadow-lg whitespace-nowrap"
              >
                Proceder al Pago
                <i className="ri-arrow-right-line ml-2"></i>
              </button>

              {/* Información adicional */}
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <i className="ri-time-line text-[#D75F1E] mt-0.5"></i>
                  <div>
                    <p className="font-medium text-[#2D3A52]">Tiempo de preparación</p>
                    <p className="text-[#2D3A52]/70 text-xs">5-10 minutos tras el pago</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-sm">
                  <i className="ri-shield-check-line text-[#D75F1E] mt-0.5"></i>
                  <div>
                    <p className="font-medium text-[#2D3A52]">Pago seguro</p>
                    <p className="text-[#2D3A52]/70 text-xs">Procesado de forma segura</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;
