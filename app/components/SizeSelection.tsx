'use client';

import { useState } from 'react';
import { Size } from '../types';

interface SizeSelectionProps {
  onSizeSelect: (size: Size) => void;
  onBack: () => void;
}

const SizeSelection = ({ onSizeSelect, onBack }: SizeSelectionProps) => {
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);

  const sizes: Size[] = [
    {
      id: 'kiosco',
      name: 'Foto Kiosco',
      dimensions: '10x15 cm (4x6 pulgadas)',
      price: '1000',
      width: 15,
      height: 10,
      gradient: 'from-pink-400 via-red-500 to-pink-300',
      requiresEven: true
    },
    {
      id: 'medium',
      name: 'Foto Kiosco',
      dimensions: '13x18 cm (5x7 pulgadas)',
      price: '1500',
      width: 18,
      height: 13,
      gradient: 'from-teal-400 via-blue-500 to-blue-600'
    },
    {
      id: 'large',
      name: 'Foto Kiosco',
      dimensions: '15x20 cm (6x8 pulgadas)',
      price: '20',
      width: 20,
      height: 15,
      gradient: 'from-purple-300 via-pink-300 to-purple-400'
    },
    {
      id: 'square-small',
      name: 'Foto Kiosco',
      dimensions: '13x13 cm (5x5 pulgadas)',
      price: '1200',
      width: 13,
      height: 13,
      gradient: 'from-orange-300 via-yellow-400 to-red-400'
    },
    {
      id: 'square-large',
      name: 'Foto Kiosco',
      dimensions: '15x15 cm (6x6 pulgadas)',
      price: '1800',
      width: 15,
      height: 15,
      gradient: 'from-indigo-400 via-purple-500 to-pink-400'
    }
  ];

  const handleSizeClick = (size: Size) => {
    setSelectedSize(size);
    // Automáticamente continuar después de seleccionar
    setTimeout(() => {
      onSizeSelect(size);
    }, 300);
  };

  // Componente para la representación visual del tamaño
  const SizePreview = ({ size, isSelected, isMobile = false }: { size: Size; isSelected: boolean; isMobile?: boolean }) => {
    const scale = isMobile ? 4 : 6; // Factor de escala para visualización
    const width = size.width * scale;
    const height = size.height * scale;

    return (
      <div className="flex justify-center items-center">
        <div className="relative group">
          <div
            className={`border-4 border-white shadow-lg transition-all duration-500 ease-out relative overflow-hidden ${isSelected ? 'ring-4 ring-[#D75F1E] ring-offset-2 scale-105' : 'hover:scale-110'
              }`}
            style={{
              width: `${width}px`,
              height: `${height}px`,
              maxWidth: isMobile ? '80px' : '120px',
              maxHeight: isMobile ? '120px' : '160px'
            }}
          >
            {/* Gradiente de fondo sin puntos */}
            <div className={`w-full h-full bg-gradient-to-br ${size.gradient} relative`}>
              {/* Efecto de brillo animado que se mueve */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full transition-transform duration-1000 ease-in-out"
                style={{
                  animation: 'slideShine 3s infinite ease-in-out'
                }}
              ></div>
            </div>
          </div>



          {/* Indicador de selección */}
          {isSelected && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#D75F1E] rounded-full flex items-center justify-center shadow-lg animate-bounce">
              <i className="ri-check-line text-white text-sm"></i>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 sm:px-8 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#2D3A52] hover:text-[#D75F1E] transition-all duration-200 whitespace-nowrap hover:scale-105"
          >
            <i className="ri-arrow-left-line text-xl"></i>
            <span className="text-base sm:text-lg font-medium">Volver</span>
          </button>

          <div className="text-center flex-1 px-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2D3A52] mb-2">Selecciona el Tamaño</h1>
            <p className="text-base sm:text-lg text-[#2D3A52]/70 hidden sm:block">Elige el formato perfecto para tus fotos</p>
          </div>

          <div className="w-12 sm:w-24"></div>
        </div>

        {/* Vista móvil: Lista vertical */}
        <div className="block sm:hidden space-y-4 mb-8">
          {sizes.map((size) => (
            <div
              key={size.id}
              className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 cursor-pointer transition-all duration-500 ease-out hover:shadow-2xl ${selectedSize?.id === size.id
                ? 'ring-4 ring-[#D75F1E] shadow-2xl scale-105'
                : 'shadow-lg hover:scale-102'
                }`}
              onClick={() => handleSizeClick(size)}
            >
              <div className="flex items-center justify-center text-center">
                <div className="flex flex-col items-center">
                  {/* Representación visual del tamaño */}
                  <div className="mb-6">
                    <SizePreview
                      size={size}
                      isSelected={selectedSize?.id === size.id}
                      isMobile={true}
                    />
                  </div>

                  {/* Texto centrado */}
                  <div>
                    <h3 className="text-lg font-bold text-[#2D3A52] mb-1">{size.name}</h3>
                    <p className="text-[#2D3A52]/70 mb-2">{size.dimensions}</p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[#D75F1E] font-bold text-lg">${size.price}</span>
                      <span className="text-[#2D3A52]/70 text-sm">par</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Vista desktop: Grid */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8 mb-12">
          {sizes.map((size) => (
            <div
              key={size.id}
              className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 cursor-pointer transition-all duration-500 ease-out hover:shadow-2xl hover:-translate-y-2 ${selectedSize?.id === size.id
                ? 'ring-4 ring-[#D75F1E] shadow-2xl -translate-y-2'
                : 'shadow-lg'
                }`}
              onClick={() => handleSizeClick(size)}
            >
              <div className="mb-6 flex justify-center">
                <SizePreview
                  size={size}
                  isSelected={selectedSize?.id === size.id}
                  isMobile={false}
                />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-[#2D3A52] mb-2">{size.name}</h3>
                <p className="text-[#2D3A52]/70 mb-3">{size.dimensions}</p>
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 inline-block shadow-sm">
                  <span className="text-[#D75F1E] font-bold text-lg">${size.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Información adicional */}
        <div className="mt-8 sm:mt-16 text-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 max-w-4xl mx-auto shadow-xl">
            <h3 className="text-lg sm:text-xl font-bold text-[#2D3A52] mb-4">Información Importante</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-left">
              <div>
                <h4 className="font-semibold text-[#2D3A52] mb-2">Calidad Premium</h4>
                <p className="text-sm sm:text-base text-[#2D3A52]/70">Papel fotográfico profesional con acabado brillante</p>
              </div>
              <div>
                <h4 className="font-semibold text-[#2D3A52] mb-2">Impresión Instantánea</h4>
                <p className="text-sm sm:text-base text-[#2D3A52]/70">Tus fotos estarán listas en menos de 5 minutos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideShine {
          0% { 
            transform: translateX(-100%) skewX(-12deg); 
          }
          50% { 
            transform: translateX(100%) skewX(-12deg); 
          }
          100% { 
            transform: translateX(200%) skewX(-12deg); 
          }
        }
        
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
};

export default SizeSelection;