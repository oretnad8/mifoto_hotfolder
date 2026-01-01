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

export interface EditParams {
    rotation: number;
    scale: number;
    brightness: number; // 0.5 to 1.5, default 1
    saturation: number; // 0.5 to 1.5, default 1
    contrast: number;   // 0.5 to 1.5, default 1
    fit: 'contain' | 'cover';
    crop?: { x: number; y: number; width: number; height: number };
    aspectRatio?: number;
    resize?: { width?: number; height?: number };
}

export interface Photo {
    id: string;
    name: string;
    preview: string;
    file: File;
    editParams?: EditParams;
    sourcePath?: string;
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
    orderNumber?: number;
}

export interface PrinterStatus {
    Name: string;
    Model: string;
    Status: string;
    MediaType: string;
    MediaRemaining: number;
    LifeCounter: number;
    SerialNumber: string;
    FirmwareVersion: string;
    ColorDataVersion: string;
}
