export interface Size {
    id: string;
    name: string;
    dimensions: string;
    price: string;
    width: number;
    height: number;
    gradient: string;
    requiresEven?: boolean;
}

export interface Photo {
    id: string;
    name: string;
    preview: string;
    file: File;
}

export interface CartItem {
    id: number;
    size: Size;
    photos: Photo[];
    totalPhotos: number;
    subtotal: number;
}

export interface OrderItem {
    size: Size;
    photos: Array<{
        id: string;
        file?: File;
    }>;
}

export interface Order {
    id: string;
    items: CartItem[];
    total: number;
    totalPhotos: number;
    createdAt: Date;
    status: string;
    kiosk: {
        name: string;
        address: string;
    };
    customerName?: string;
    customerEmail?: string;
    paymentMethod?: string;
    paidAt?: Date;
    orderNumber?: string;
}
