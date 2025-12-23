'use client';

import { useState, useEffect } from 'react';

interface PrinterStatus {
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

export default function PrinterStatusWidget() {
    const [printers, setPrinters] = useState<PrinterStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await fetch('/api/admin/printer-status');
                if (response.ok) {
                    const data = await response.json();
                    // Ensure data is array
                    const statusArray = Array.isArray(data) ? data : [];
                    setPrinters(statusArray);
                }
            } catch (error) {
                console.error('Failed to fetch printer status', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        // Optional: could poll here if desired, but user said "al cargar la página"
    }, []);

    const getStatusColor = (status: string) => {
        // Normalize for comparison
        const s = status ? status.toUpperCase() : '';
        if (s.includes('OK') || s.includes('READY') || s.includes('IDLE')) return 'bg-green-500';
        if (s.includes('OFFLINE') || s.includes('ERROR')) return 'bg-red-500';
        return 'bg-yellow-500';
    };

    if (loading) return null;
    if (printers.length === 0) return null;

    return (
        <div className="flex gap-4">
            {printers.map((printer, idx) => (
                <div
                    key={idx}
                    className="bg-white px-4 py-2 rounded-2xl border border-[#2D3A52]/10 shadow-sm flex items-center gap-3"
                >
                    <div
                        className={`w-3 h-3 rounded-full ${getStatusColor(printer.Status)} animate-pulse`}
                        title={printer.Status}
                    />

                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D3A52] uppercase tracking-wider">
                            {printer.Model}
                            <span className="text-[#2D3A52]/50 ml-1 text-[10px] font-normal">{printer.SerialNumber}</span>
                        </span>
                        <span className="text-sm font-bold text-[#D75F1E]">
                            {printer.MediaRemaining} <span className="text-[#2D3A52]/60 font-normal text-xs">fotos rest.</span>
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
