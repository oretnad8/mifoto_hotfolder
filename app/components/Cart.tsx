'use client';

import { useState, useEffect } from 'react';
import { Size, Photo, CartItem } from '../types';

interface CartProps {
  items: CartItem[];
  selectedSize: Size | null;
  photos: Photo[];
  onConfirm: (items: CartItem[]) => void;
  onBack: () => void;
  onAddMore: () => void;
  onUpdateCart?: (items: CartItem[]) => void;
}



const Cart = ({ items = [], selectedSize, photos = [], onConfirm, onBack, onAddMore, onUpdateCart }: CartProps) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(items);
  const [showModal, setShowModal] = useState(false);
  const [hasProcessedNew, setHasProcessedNew] = useState(false);

  const isPairSize = (sizeId: string) => {
    return sizeId === 'kiosco' || sizeId === 'square-small';
  };

  // Sync props to state if items are provided externally (e.g. loaded from localStorage in parent)
  useEffect(() => {
    if (items && items.length > 0) {
      setCartItems(items);
    }
  }, [items]);

  // Handle new photos incoming from upload
  useEffect(() => {
    if (photos && photos.length > 0 && selectedSize && !hasProcessedNew) {
      const totalPhotos = photos.length;
      let subtotal = 0;

      // Calculate subtotal based on size rules
      if (isPairSize(selectedSize.id)) {
        subtotal = Math.ceil(totalPhotos / 2) * parseFloat(selectedSize.price);
      } else {
        subtotal = totalPhotos * parseFloat(selectedSize.price);
      }

      // Check for existing item of same size to merge
      const existingItemIndex = cartItems.findIndex((item: CartItem) => item.size.id === selectedSize.id);
      let newCartItems = [...cartItems];

      if (existingItemIndex >= 0) {
        // Merge with existing item
        const existingItem = newCartItems[existingItemIndex];

        // Combine photos, avoiding duplicates if necessary (using ID)
        // Assuming uploads are always new or distinct for now
        const mergedPhotos = [...existingItem.photos, ...photos];

        const newTotal = mergedPhotos.length;
        let newSubtotal = 0;
        if (isPairSize(selectedSize.id)) {
          newSubtotal = Math.ceil(newTotal / 2) * parseFloat(selectedSize.price);
        } else {
          newSubtotal = newTotal * parseFloat(selectedSize.price);
        }

        newCartItems[existingItemIndex] = {
          ...existingItem,
          photos: mergedPhotos,
          totalPhotos: newTotal,
          subtotal: newSubtotal
        };
      } else {
        // Create New Item
        const newItem: CartItem = {
          id: Date.now(),
          size: selectedSize,
          photos: photos,
          totalPhotos: totalPhotos,
          subtotal: subtotal
        };
        newCartItems.push(newItem);
      }

      setCartItems(newCartItems);
      if (onUpdateCart) {
        onUpdateCart(newCartItems);
      }
      setHasProcessedNew(true);
    }
  }, [photos, selectedSize, hasProcessedNew, cartItems, onUpdateCart]);

  // Reset flag if incoming photos change (e.g. re-upload triggered)
  useEffect(() => {
    if (photos.length === 0) {
      setHasProcessedNew(false);
    }
  }, [photos]);

  const removeItem = (itemId: number) => {
    const newItems = cartItems.filter((i: CartItem) => i.id !== itemId);
    setCartItems(newItems);
    if (onUpdateCart) onUpdateCart(newItems);
  };

  const removePhoto = (itemId: number, photoId: string) => {
    let newItems = [...cartItems];
    const itemIndex = newItems.findIndex((i: CartItem) => i.id === itemId);
    if (itemIndex === -1) return;

    const item = newItems[itemIndex];
    const newPhotos = item.photos.filter((p: Photo) => p.id !== photoId);

    if (newPhotos.length === 0) {
      newItems.splice(itemIndex, 1);
    } else {
      const newTotal = newPhotos.length;
      let newSubtotal = 0;
      if (isPairSize(item.size.id)) {
        newSubtotal = Math.ceil(newTotal / 2) * parseFloat(item.size.price);
      } else {
        newSubtotal = newTotal * parseFloat(item.size.price);
      }
      newItems[itemIndex] = { ...item, photos: newPhotos, totalPhotos: newTotal, subtotal: newSubtotal };
    }

    setCartItems(newItems);
    if (onUpdateCart) onUpdateCart(newItems);
  };

  const handleFinalize = () => {
    // Validate pairs
    const invalidItem = cartItems.find((item: CartItem) =>
      isPairSize(item.size.id) && item.totalPhotos % 2 !== 0
    );

    if (invalidItem) {
      alert(`El producto ${invalidItem.size.name} requiere una cantidad par de fotos.`);
      return;
    }
    setShowModal(true);
  };

  const getTotalAmount = () => cartItems.reduce((sum: number, item: CartItem) => sum + item.subtotal, 0);
  const getTotalPhotos = () => cartItems.reduce((sum: number, item: CartItem) => sum + item.totalPhotos, 0);

  if (cartItems.length === 0 && (!photos || photos.length === 0)) {
    return (
      <div className="min-h-screen bg-white px-8 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-[#FCF4F3] rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-shopping-cart-line text-4xl text-[#2D3A52]/50"></i>
          </div>
          <h2 className="text-2xl font-bold text-[#2D3A52] mb-4">Carrito Vacío</h2>
          <p className="text-[#2D3A52]/70 mb-8">No tienes productos en tu carrito</p>
          <button
            onClick={onAddMore}
            className="bg-[#D75F1E] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#D75F1E]/90 transition-colors duration-200 whitespace-nowrap"
          >
            Añadir Productos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-8 py-12">
      <div className="max-w-6xl mx-auto">
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
            <h1 className="text-3xl font-bold text-[#2D3A52] mb-2">Tu Carrito</h1>
            <p className="text-lg text-[#2D3A52]/70">Revisa tu pedido</p>
          </div>

          <div className="w-24"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product List */}
          <div className="lg:col-span-2 space-y-6">
            {cartItems.map((item: CartItem, index: number) => (
              <div key={item.id} className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-[#2D3A52]">
                      Producto #{index + 1} - {item.size.name}
                      {isPairSize(item.size.id) && <span className="ml-2 text-sm text-[#D75F1E] font-normal">(Pack Par)</span>}
                    </h3>
                    <p className="text-[#2D3A52]/70">
                      {item.size.dimensions} • ${item.size.price} {isPairSize(item.size.id) ? '(par)' : '(u)'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#D75F1E]">${item.subtotal.toFixed(0)}</p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-700 text-sm mt-2 underline cursor-pointer"
                    >
                      Eliminar Producto
                    </button>
                  </div>
                </div>

                {/* Photos List */}
                <div className="space-y-4">
                  {item.photos.map((photo: Photo) => (
                    <div key={photo.id} className="bg-white/80 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={photo.preview} alt={photo.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-medium text-[#2D3A52] truncate max-w-[150px]">{photo.name}</span>
                      </div>
                      <button
                        onClick={() => removePhoto(item.id, photo.id)}
                        className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-600 transition-colors"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  ))}
                </div>

              </div>
            ))}

            <button
              onClick={onAddMore}
              className="w-full bg-white border-2 border-[#D75F1E] text-[#D75F1E] py-4 rounded-xl font-bold text-lg hover:bg-[#D75F1E] hover:text-white transition-all duration-200"
            >
              <i className="ri-add-line mr-2"></i>
              Añadir Más Tamaños
            </button>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-6 sticky top-8">
              <h3 className="text-xl font-bold text-[#2D3A52] mb-6">Resumen del Pedido</h3>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-3 border-b border-white/50">
                  <span className="text-[#2D3A52]/70">Total Fotos:</span>
                  <span className="font-bold text-[#2D3A52]">{getTotalPhotos()}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-lg font-semibold text-[#2D3A52]">Total:</span>
                  <span className="text-2xl font-bold text-[#D75F1E]">${getTotalAmount().toFixed(0)}</span>
                </div>
              </div>

              <button
                onClick={handleFinalize}
                disabled={cartItems.length === 0}
                className="w-full bg-[#D75F1E] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#D75F1E]/90 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Pedido
                <i className="ri-arrow-right-line ml-2"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Confirm */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md mx-4">
              <h3 className="text-xl font-bold text-[#2D3A52] mb-4">¿Confirmar Pedido?</h3>
              <p className="text-[#2D3A52]/70 mb-6">Estás a un paso de imprimir tus recuerdos.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 text-[#2D3A52] py-3 rounded-xl font-medium"
                >
                  Volver
                </button>
                <button
                  onClick={() => onConfirm(cartItems)}
                  className="flex-1 bg-[#D75F1E] text-white py-3 rounded-xl font-bold"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
