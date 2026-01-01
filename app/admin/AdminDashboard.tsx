"use client";

import React, { useState } from "react";
import AdminLogin from "../components/AdminLogin";
import ValidateButton from "./ValidateButton";
import AutoRefresh from "../components/AutoRefresh";
import PrinterStatusWidget from "./PrinterStatusWidget";
import { Order } from "@prisma/client";

interface AdminDashboardProps {
    initialOrders: Order[];
    totalOrders: number;
    page: number;
    totalPages: number;
}

export default function AdminDashboard({
    initialOrders,
    totalOrders,
    page,
    totalPages,
}: AdminDashboardProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <header className="bg-white shadow-sm p-4">
                    <h1 className="text-xl font-bold text-[#2D3A52] text-center">Panel de Administración</h1>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <AdminLogin onLogin={() => setIsAuthenticated(true)} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-[#2D3A52] p-8">
            <AutoRefresh intervalMs={15000} /> {/* Increased interval to avoid pagination jank */}
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-4xl font-bold text-[#2D3A52]">Validador</h1>
                        <p className="text-[#2D3A52]/70 mt-2 text-lg">
                            Gestión de órdenes y validación de pagos
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsAuthenticated(false)}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors text-sm"
                        >
                            Cerrar Sesión
                        </button>
                        <PrinterStatusWidget />
                        <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] px-6 py-3 rounded-2xl border border-white/50 text-sm shadow-sm text-right">
                            <div>
                                Total Órdenes:{" "}
                                <span className="font-bold text-[#D75F1E] text-lg ml-1">
                                    {totalOrders}
                                </span>
                            </div>
                            <div className="text-xs text-[#2D3A52]/60">
                                Página {page} de {totalPages}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="grid gap-6">
                    {initialOrders.length === 0 ? (
                        <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-12 text-center shadow-lg">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <i className="ri-inbox-line text-4xl text-[#D75F1E]"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[#2D3A52] mb-2">
                                No hay órdenes registradas
                            </h3>
                            <p className="text-[#2D3A52]/70">
                                Las nuevas órdenes aparecerán automáticamente aquí.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-[#2D3A52]/10 rounded-2xl overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#2D3A52]/5 text-xs uppercase tracking-wider text-[#2D3A52]/70">
                                            <th className="p-6 font-semibold">ID / Fecha</th>
                                            <th className="p-6 font-semibold">Cliente</th>
                                            <th className="p-6 font-semibold">Método</th>
                                            <th className="p-6 font-semibold">Estado</th>
                                            <th className="p-6 font-semibold">Tamaño / Cantidad</th>
                                            <th className="p-6 font-semibold">Total</th>
                                            <th className="p-6 font-semibold text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2D3A52]/10">
                                        {initialOrders.map((order) => {
                                            const client = order.client as any;
                                            // Allow validation for both legacy 'transfer' and new 'cash' (Pay at Counter) methods
                                            const isPendingPayment =
                                                order.status === "pending" &&
                                                (order.paymentMethod === "transfer" ||
                                                    order.paymentMethod === "cash");
                                            const items = (order.items as any[]) || [];

                                            return (
                                                <tr
                                                    key={order.id}
                                                    className="hover:bg-[#2D3A52]/5 transition-colors group"
                                                >
                                                    <td className="p-6">
                                                        <div className="font-mono text-[#D75F1E] font-bold text-lg">
                                                            #{order.id.slice(0, 8)}
                                                        </div>
                                                        <div className="text-xs text-[#2D3A52]/60 mt-1 flex items-center gap-1">
                                                            <i className="ri-time-line"></i>
                                                            {new Date(order.createdAt).toLocaleDateString()} •{" "}
                                                            {new Date(order.createdAt).toLocaleTimeString()}
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="font-bold text-[#2D3A52]">
                                                            {client?.name || "Invitado"}
                                                        </div>
                                                        <div className="text-xs text-[#2D3A52]/60">
                                                            {client?.email}
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span
                                                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize
                                                            ${order.paymentMethod ===
                                                                    "transfer" ||
                                                                    order.paymentMethod ===
                                                                    "cash"
                                                                    ? "bg-[#D75F1E]/10 text-[#D75F1E]"
                                                                    : "bg-[#2D3A52]/10 text-[#2D3A52]"
                                                                }`}
                                                        >
                                                            {order.paymentMethod === "transfer"
                                                                ? "Transferencia"
                                                                : order.paymentMethod === "cash"
                                                                    ? "Pago en Caja"
                                                                    : order.paymentMethod === "mercadopago"
                                                                        ? "Mercado Pago"
                                                                        : order.paymentMethod}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        <StatusBadge status={order.status} />
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="space-y-1">
                                                            {items.map((item, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="text-sm text-[#2D3A52] flex items-center gap-2"
                                                                >
                                                                    <span className="font-bold bg-gray-100 px-2 py-0.5 rounded text-xs">
                                                                        {(
                                                                            item.size?.dimensions ||
                                                                            item.size?.name ||
                                                                            "Tamaño?"
                                                                        ).split(" (")[0]}
                                                                    </span>
                                                                    <span className="text-xs text-[#2D3A52]/70">
                                                                        x{item.totalPhotos}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-6 font-bold text-[#2D3A52] text-lg">
                                                        ${order.total.toLocaleString("es-CL")}
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        {isPendingPayment ? (
                                                            <ValidateButton orderId={order.id} />
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2D3A52]/40 bg-[#2D3A52]/5 px-3 py-1 rounded-full">
                                                                {order.status === "validated" && (
                                                                    <i className="ri-check-double-line"></i>
                                                                )}
                                                                {order.status === "validated"
                                                                    ? "Completado"
                                                                    : "Sin acciones"}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                <div className="mt-8 flex justify-center gap-4">
                    {page > 1 && (
                        <a
                            href={`/admin?page=${page - 1}`}
                            className="bg-white border border-[#2D3A52]/20 text-[#2D3A52] px-6 py-3 rounded-xl font-bold hover:bg-[#2D3A52]/5 transition-colors"
                        >
                            <i className="ri-arrow-left-line mr-2"></i>
                            Anterior
                        </a>
                    )}

                    {page < totalPages && (
                        <a
                            href={`/admin?page=${page + 1}`}
                            className="bg-[#D75F1E] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#D75F1E]/90 transition-colors shadow-lg"
                        >
                            Siguiente
                            <i className="ri-arrow-right-line ml-2"></i>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
        paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
        validated: "bg-[#CEDFE7] text-[#2D3A52] border-[#2D3A52]/10",
        cancelled: "bg-red-100 text-red-700 border-red-200",
    };

    const style = styles[status] || "bg-gray-100 text-gray-600 border-gray-200";
    const label =
        {
            pending: "Pendiente",
            paid: "Pagado",
            validated: "Validado",
            cancelled: "Cancelado",
        }[status] || status;

    return (
        <span
            className={`px-3 py-1 rounded-lg text-xs font-bold border ${style} inline-flex items-center gap-1.5`}
        >
            <span
                className={`w-1.5 h-1.5 rounded-full ${status === "validated" ? "bg-[#2D3A52]" : "bg-current"
                    }`}
            ></span>
            {label}
        </span>
    );
}
