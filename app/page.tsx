// app/page.tsx - Versión actualizada simplificada
'use client';

import { useState, useEffect } from 'react';
import CategoryScreen from './components/CategoryScreen';
import SizeSelection from './components/SizeSelection';
import PhotoUpload from './components/PhotoUpload';
import Cart from './components/Cart';
import Confirmation from './components/Confirmation';
import Payment from './components/Payment';
import FinalCode from './components/FinalCode';
import { Size, Photo, CartItem, Order } from './types';

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<Photo[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [showCartIcon, setShowCartIcon] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem('mifoto-cart');
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      setCartItems(parsedCart);
      setShowCartIcon(parsedCart.length > 0);
    }
  }, []);

  useEffect(() => {
    setShowCartIcon(cartItems.length > 0);
    localStorage.setItem('mifoto-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const handleCategorySelect = (category: string) => {
    if (category === 'instant') {
      setSelectedCategory(category);
      setCurrentScreen(2);
    }
  };

  const handleSizeSelect = (size: Size) => {
    setSelectedSize(size);
    setCurrentScreen(3);
  };

  const handlePhotosUploaded = (photos: Photo[]) => {
    setUploadedPhotos(photos);
    setCurrentScreen(5); // Ir directo al carrito (Screen 5), saltando editor (Screen 4)
  };

  const handleCartConfirm = (items: CartItem[]) => {
    setCartItems(items);
    setCurrentScreen(6);
  };

  const handleOrderConfirm = (order: any) => {
    setOrderData(order);
    setCurrentScreen(7);
  };

  const handlePaymentSuccess = (paidOrder: any) => {
    setOrderData(paidOrder);
    sendToPrintingSystem(paidOrder);
  };

  const sendToPrintingSystem = async (orderData: any) => {
    console.log('Starting sendToPrintingSystem with data:', orderData);
    setIsLoading(true);
    try {
      // Deep copy created items to avoid mutating state directly
      const updatedItems = JSON.parse(JSON.stringify(orderData.items));

      // 1. Upload Photos and get server filenames
      for (let i = 0; i < orderData.items.length; i++) {
        const item = orderData.items[i];
        console.log(`Processing item ${i}:`, item);
        const formData = new FormData();
        formData.append('sizeId', item.size.id);

        const rawPhotos = item.photos || [];
        for (const photo of rawPhotos) {
          if (photo.file) {
            formData.append('photos', photo.file);
          }
        }

        console.log('Uploading photos...');
        const response = await fetch('/api/upload-photos', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          // result.files is array of { originalName, fileName }
          // Map back to updatedItems
          if (result.files && result.files.length > 0) {
            console.log('Mapping files. Result files:', result.files);
            updatedItems[i].photos = updatedItems[i].photos.map((p: any) => {
              const serverFile = result.files.find((f: any) => f.name === p.name);
              // Note: endpoint returns { name, fileName }, not originalName wrapped in name? 
              // CHECK upload-photos route:
              // uploadedFiles.push({ name: file.name, fileName: fileName });
              // So property is 'name', not 'originalName'.

              if (!serverFile) {
                console.warn('Matching file not found for:', p.name);
              }

              return {
                ...p,
                fileName: serverFile ? serverFile.fileName : p.name,
                file: undefined
              };
            });
          }
        } else {
          console.error('Error uploading photos for size', item.size.id, response.status);
        }
      }

      console.log('All photos uploaded. Creating order in DB with items:', updatedItems);

      // 2. Create Order in Database
      const finalOrder = {
        client: {
          name: orderData.customerName,
          kiosk: orderData.kiosk,
          // email: orderData.customerEmail 
        },
        items: updatedItems,
        total: orderData.total,
        paymentMethod: orderData.paymentMethod,
        status: orderData.status
      };

      const createResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalOrder),
      });

      console.log('Order creation response status:', createResponse.status);

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        console.error('Order creation failed:', errText);
        throw new Error('Failed to create order: ' + errText);
      }

      const createdOrder = await createResponse.json();
      console.log('Order created successfully:', createdOrder);

      // Optionally, if the API returns the created order ID, we can update it?
      // But we generated ID on frontend. That's fine for now, or use server ID.

      // Clear cart and photos after successful order
      setCartItems([]);
      setUploadedPhotos([]);
      setShowCartIcon(false);
      localStorage.removeItem('mifoto-cart');

      setCurrentScreen(8);
    } catch (error) {
      console.error('Error sending to printing system:', error);
      alert('Hubo un error al procesar el pedido. Por favor intente nuevamente. Ver consola para detalles.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewOrder = () => {
    setCurrentScreen(1);
    setSelectedCategory('');
    setSelectedSize(null);
    setUploadedPhotos([]);
    setCartItems([]);
    setOrderData(null);
    setShowCartIcon(false);
    localStorage.removeItem('mifoto-cart');
  };

  const handleBackToMain = () => {
    if (cartItems.length > 0 || uploadedPhotos.length > 0) {
      setShowExitWarning(true);
    } else {
      setCurrentScreen(1);
    }
  };

  const confirmExit = () => {
    setCurrentScreen(1);
    setSelectedCategory('');
    setSelectedSize(null);
    setUploadedPhotos([]);
    setCartItems([]);
    setOrderData(null);
    setShowCartIcon(false);
    setShowExitWarning(false);
    localStorage.removeItem('mifoto-cart');
  };

  const showCart = () => {
    setCurrentScreen(5);
  };

  return (
    <div className="min-h-screen bg-white relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-[#D75F1E] rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <i className="ri-upload-cloud-fill text-white text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-[#2D3A52] mb-2">Enviando Fotos</h3>
            <p className="text-[#2D3A52]/70">Tus recuerdos se están transfiriendo...</p>
          </div>
        </div>
      )}

      {/* Icono del carrito flotante */}
      {showCartIcon && currentScreen !== 5 && currentScreen !== 6 && currentScreen !== 7 && currentScreen !== 8 && (
        <div className="fixed top-8 right-8 z-50">
          <button
            onClick={showCart}
            className="bg-[#D75F1E] text-white w-16 h-16 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 cursor-pointer relative"
          >
            <i className="ri-shopping-cart-fill text-2xl"></i>
            <div className="absolute -top-2 -right-2 bg-white text-[#D75F1E] w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border-2 border-[#D75F1E]">
              {cartItems.length}
            </div>
          </button>
        </div>
      )}

      {currentScreen === 1 && (
        <CategoryScreen onCategorySelect={handleCategorySelect} />
      )}
      {currentScreen === 2 && (
        <SizeSelection
          onSizeSelect={handleSizeSelect}
          onBack={handleBackToMain}
        />
      )}
      {currentScreen === 3 && (
        <PhotoUpload
          selectedSize={selectedSize}
          onPhotosUploaded={handlePhotosUploaded}
          onBack={() => setCurrentScreen(2)}
        />
      )}

      {/* Screen 4 (Editor) Eliminado */}

      {currentScreen === 5 && (
        <Cart
          items={cartItems}
          selectedSize={selectedSize}
          photos={uploadedPhotos}
          onConfirm={handleCartConfirm}
          onBack={() => setCurrentScreen(3)}
          onAddMore={() => setCurrentScreen(2)} // Volver a selección de tamaño
          onUpdateCart={setCartItems}
          onClearNewPhotos={() => setUploadedPhotos([])}
        />
      )}
      {currentScreen === 6 && (
        <Confirmation
          cartItems={cartItems}
          onConfirm={handleOrderConfirm}
          onBack={() => setCurrentScreen(5)}
        />
      )}
      {currentScreen === 7 && orderData && (
        <Payment
          orderData={orderData}
          onPaymentSuccess={handlePaymentSuccess}
          onBack={() => setCurrentScreen(6)}
        />
      )}
      {currentScreen === 8 && orderData && (
        <FinalCode
          orderData={orderData}
          onNewOrder={handleNewOrder}
        />
      )}

      {/* Modal de advertencia de salida */}
      {showExitWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-alert-line text-yellow-600 text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-[#2D3A52] mb-2">¿Salir sin guardar?</h3>
              <p className="text-[#2D3A52]/70">
                Perderás el pedido actual. ¿Deseas continuar?
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowExitWarning(false)}
                className="flex-1 bg-gray-100 text-[#2D3A52] py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200 whitespace-nowrap"
              >
                Continuar
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 bg-[#D75F1E] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#D75F1E]/90 transition-colors duration-200 whitespace-nowrap"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}