"use client";

import { useEffect, useState } from "react";
import { PrinterStatus } from "../types";

export default function PrinterMonitor() {
    const [showModal, setShowModal] = useState(false);
    // Use a timestamp to handle snooze functionality if needed in future, 
    // for now we just close it until the next poll cycle might re-trigger it 
    // (though the requirements say "Al dar clic en "Aceptar", el modal se cierra").
    // If we want it to stay closed, we might need state to track "acknowledged" status for the current zero-media event.
    // However, if media is 0, it probably SHOULD annoy them until fixed. 
    // But let's stick to the basic requirement: Close on accept.
    // To avoid immediate reopening on next poll (5s later) if they haven't fixed it yet, 
    // we can use a simple "snoozed" state.
    const [isSnoozed, setIsSnoozed] = useState(false);

    useEffect(() => {
        // Check if running in Electron
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof window === "undefined" || !(window as any).electron) {
            return;
        }

        const checkPrinterStatus = async () => {
            try {
                const response = await fetch("/api/admin/printer-status");
                if (!response.ok) return;

                const data: PrinterStatus[] = await response.json();

                // Find if any printer has MediaRemaining === 0
                const emptyPrinter = data.find((p) => p.MediaRemaining === 0);

                if (emptyPrinter) {
                    // Only show if not currently snoozed
                    if (!isSnoozed) {
                        setShowModal(true);
                    }
                } else {
                    // If media is replenished (no printer with 0), reset snooze and modal
                    setIsSnoozed(false);
                    setShowModal(false);
                }
            } catch (error) {
                console.error("Error checking printer status:", error);
            }
        };

        // Initial check
        checkPrinterStatus();

        // Poll every 30 seconds
        const interval = setInterval(checkPrinterStatus, 30000);

        return () => clearInterval(interval);
    }, [isSnoozed]);

    const handleAccept = () => {
        setShowModal(false);
        setIsSnoozed(true);

        // Optional: Reset snooze after 5 minutes to remind again if still not fixed?
        // For now, simpler is better based on "Al dar clic en 'Aceptar', el modal se cierra."
        // But if we just close it and don't snooze, the next poll in 5s will open it again instantly 
        // if the condition persists. So 'isSnoozed' is necessary.
        // Let's set a timeout to un-snooze after 2 minutes just in case they forgot.
        setTimeout(() => {
            setIsSnoozed(false);
        }, 120000); // 2 minutes
    };

    if (!showModal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
                <div className="bg-red-600 p-6 text-white">
                    <h2 className="flex items-center gap-3 text-2xl font-bold">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="h-8 w-8"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                            />
                        </svg>
                        Atención: Impresora sin insumos
                    </h2>
                </div>

                <div className="p-8">
                    <p className="mb-8 text-lg text-gray-700 leading-relaxed">
                        El contador de la impresora <span className="font-semibold">DNP DS620A</span> ha llegado a 0.
                        <br />
                        Por favor, reemplace la cinta (ribbon) y el papel para continuar con la impresión.
                    </p>

                    <div className="flex justify-end">
                        <button
                            onClick={handleAccept}
                            className="rounded-xl bg-red-600 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/30 active:scale-95 transform duration-100"
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
