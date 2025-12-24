
'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface CategoryScreenProps {
  onCategorySelect: (category: string) => void;
}

const CategoryScreen = ({ onCategorySelect }: CategoryScreenProps) => {
  const [hoveredCard, setHoveredCard] = useState(false);
  const [serverIp, setServerIp] = useState<string | null>(null);

  useEffect(() => {
    const fetchIp = async () => {
      // @ts-ignore
      if (typeof window !== 'undefined' && window.electron && window.electron.getLocalIp) {
        try {
          // @ts-ignore
          const ip = await window.electron.getLocalIp();
          if (ip) {
            setServerIp(ip);
          }
        } catch (error) {
          console.error("Failed to get local IP", error);
        }
      }
    };
    fetchIp();
  }, []);

  return (
    <div className="min-h-screen bg-white px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto text-center h-full flex flex-col justify-between">
        {/* Header con logo */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-center justify-start">
          {/* Logo */}
          <div className="mb-4 sm:mb-0 sm:mr-20">
            <img
              src="https://static.readdy.ai/image/cb6ca7f6c3078da1085a9be5e4fc7971/2248c47c3211d3f4612acd37afbad761.png"
              alt="MiFoto Logo"
              className="h-20 sm:h-32 w-auto mx-auto sm:mx-0 animate-pulse"
              style={{
                animation: 'float 3s ease-in-out infinite',
              }}
            />
          </div>

          {/* Texto de bienvenida */}
          <div className="text-center sm:text-left">
            <p className="text-lg sm:text-3xl text-[#2D3A52] font-bold mb-2 sm:mb-4 leading-tight">
              Bienvenido a la nueva experiencia Mi foto Gift
            </p>
            <p className="text-sm sm:text-lg text-[#2D3A52]/70">¿Qué deseas imprimir hoy?</p>
          </div>
        </div>

        {/* Botón único de Fotografía Instantánea */}
        <div className="flex justify-center flex-1 items-center py-8">
          <div
            className={`relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-300 transform bg-gradient-to-br from-[#CEDFE7] to-[#FCF4F3] ${hoveredCard ? 'scale-105 shadow-2xl' : 'shadow-xl hover:shadow-2xl hover:scale-105'
              }`}
            onMouseEnter={() => setHoveredCard(true)}
            onMouseLeave={() => setHoveredCard(false)}
            onClick={() => onCategorySelect('instant')}
            style={{ minHeight: '250px', minWidth: '280px' }}
          >
            <div className="p-6 sm:p-8 h-full flex flex-col items-center justify-center text-center relative">
              {/* Icono */}
              <div className={`w-16 sm:w-20 h-16 sm:h-20 rounded-full flex items-center justify-center mb-4 sm:mb-6 transition-all duration-300 bg-[#D75F1E] text-white ${hoveredCard ? 'scale-110 shadow-xl' : ''
                }`}>
                <i className="ri-camera-fill text-2xl sm:text-4xl"></i>
              </div>

              {/* Título */}
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[#2D3A52] transition-colors duration-300">
                Fotografía Instantánea
              </h3>

              {/* Descripción */}
              <p className="text-sm sm:text-base text-[#2D3A52]/70 mb-4 sm:mb-6">
                Imprime tus fotos favoritas al instante con la mejor calidad
              </p>

              {/* Call to action */}
              <div className={`bg-white/80 rounded-2xl px-4 sm:px-6 py-2 sm:py-3 transition-all duration-300 ${hoveredCard ? 'bg-white shadow-lg' : ''
                }`}>
                <p className="text-[#D75F1E] font-bold text-base sm:text-lg">
                  Toca para comenzar
                </p>
              </div>

              {/* Efecto de brillo en hover */}
              {hoveredCard && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-pulse"></div>
              )}
            </div>
          </div>
        </div>

        {/* QR Code Section (Only in Electron) */}
        {serverIp && (
          <div className="mt-8 mb-8 animate-fade-in">
            <div className="bg-white/50 backdrop-blur-sm border border-[#CEDFE7] rounded-3xl p-6 inline-flex flex-col items-center shadow-lg transform transition-all hover:scale-105">
              <p className="text-[#2D3A52] font-semibold mb-4 text-sm sm:text-base max-w-xs mx-auto">
                O mejor aún, imprime tus recuerdos en tu teléfono escaneando este QR
              </p>
              <div className="bg-white p-3 rounded-xl shadow-inner">
                <QRCodeSVG value={`http://${serverIp}:3000`} size={180} level="H" />
              </div>

            </div>
          </div>
        )}

        {/* Información adicional - más compacta */}
        {!serverIp && (
          <div className="mt-6">
            <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-4 max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="w-10 sm:w-12 h-10 sm:h-12 bg-[#D75F1E] rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <i className="ri-time-line text-white text-lg sm:text-xl"></i>
                  </div>
                  <h4 className="font-semibold text-[#2D3A52] mb-1 text-xs sm:text-sm">Rápido</h4>
                  <p className="text-[#2D3A52]/70 text-xs">Listo en 5 minutos</p>
                </div>
                <div>
                  <div className="w-10 sm:w-12 h-10 sm:h-12 bg-[#D75F1E] rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <i className="ri-star-line text-white text-lg sm:text-xl"></i>
                  </div>
                  <h4 className="font-semibold text-[#2D3A52] mb-1 text-xs sm:text-sm">Calidad</h4>
                  <p className="text-[#2D3A52]/70 text-xs">Papel fotográfico premium</p>
                </div>
                <div>
                  <div className="w-10 sm:w-12 h-10 sm:h-12 bg-[#D75F1E] rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <i className="ri-hand-coin-line text-white text-lg sm:text-xl"></i>
                  </div>
                  <h4 className="font-semibold text-[#2D3A52] mb-1 text-xs sm:text-sm">Precio</h4>
                  <p className="text-[#2D3A52]/70 text-xs">Los mejores precios</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
          100% {
            transform: translateY(0px);
          }
        }
      `}</style>
    </div>
  );
};

export default CategoryScreen;
