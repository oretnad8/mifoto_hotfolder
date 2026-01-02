"use client";

import React, { useState } from "react";
import AdminLogin from "../components/AdminLogin";
import ValidateButton from "./ValidateButton";
import AutoRefresh from "../components/AutoRefresh";
import PrinterStatusWidget from "./PrinterStatusWidget";
import { Order } from "@prisma/client";
import { updateProductPrice, getProducts } from "@/app/actions/products";

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
    const [userRole, setUserRole] = useState<string | null>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    // Function to load products
    const loadProducts = async () => {
        setIsLoadingProducts(true);
        const data = await getProducts();
        setProducts(data);
        setIsLoadingProducts(false);
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <header className="bg-white shadow-sm p-4">
                    <h1 className="text-xl font-bold text-[#2D3A52] text-center">Panel de Acceso</h1>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <AdminLogin onLogin={(role) => {
                        if (role === 'validator') {
                            // Redirect to validator page
                            window.location.href = '/validador';
                            return;
                        }
                        setIsAuthenticated(true);
                        setUserRole(role);
                        loadProducts();
                    }} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-[#2D3A52] p-8">
            <AutoRefresh intervalMs={15000} />
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-4xl font-bold text-[#2D3A52]">
                            Panel de Administración
                        </h1>
                        <p className="text-[#2D3A52]/70 mt-2 text-lg">
                            Gestión de órdenes, precios y configuración global
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="/validador" className="bg-[#2D3A52]/10 text-[#2D3A52] px-4 py-2 rounded-lg font-medium hover:bg-[#2D3A52]/20 transition-colors text-sm">
                            Ir a Validador
                        </a>

                        <button
                            onClick={() => setIsAuthenticated(false)}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors text-sm"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFTSIDE: Orders */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-[#2D3A52]">Órdenes Recientes</h2>
                            <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] px-4 py-1.5 rounded-xl border border-white/50 text-sm shadow-sm">
                                Total: <span className="font-bold text-[#D75F1E]">{totalOrders}</span>
                            </div>
                        </div>

                        <div className="bg-white border border-[#2D3A52]/10 rounded-2xl overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#2D3A52]/5 text-xs uppercase tracking-wider text-[#2D3A52]/70">
                                            <th className="p-4 font-semibold">ID</th>
                                            <th className="p-4 font-semibold">Estado</th>
                                            <th className="p-4 font-semibold">Total</th>
                                            <th className="p-4 font-semibold text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2D3A52]/10">
                                        {initialOrders.map((order) => (
                                            <tr key={order.id} className="hover:bg-[#2D3A52]/5">
                                                <td className="p-4 text-sm font-mono">
                                                    {order.orderNumber ? `#${order.orderNumber}` : order.id.slice(0, 8)}
                                                </td>
                                                <td className="p-4"><StatusBadge status={order.status} /></td>
                                                <td className="p-4 font-bold">${order.total}</td>
                                                <td className="p-4 text-right">
                                                    <ValidateButton orderId={order.id} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 bg-gray-50 flex justify-center gap-2">
                                {page > 1 && <a href={`/admin?page=${page - 1}`} className="px-3 py-1 bg-white border rounded text-sm">Prev</a>}
                                {page < totalPages && <a href={`/admin?page=${page + 1}`} className="px-3 py-1 bg-white border rounded text-sm">Next</a>}
                            </div>
                        </div>
                    </div>

                    {/* RIGHTSIDE: Management */}
                    <div className="space-y-8">
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <h3 className="font-bold text-lg mb-4 text-[#2D3A52]">Impresoras</h3>
                            <PrinterStatusWidget />
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-[#2D3A52]">Precios y Productos</h3>
                                <button onClick={loadProducts} className="text-xs text-blue-500 hover:underline">Recargar</button>
                            </div>

                            {isLoadingProducts ? (
                                <div className="text-center py-4">Cargando...</div>
                            ) : (
                                <div className="space-y-4">
                                    {products.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <div>
                                                <div className="font-medium text-sm">{p.name}</div>
                                                <div className="text-xs text-gray-500">{p.description}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold">$</span>
                                                <input
                                                    type="number"
                                                    className="w-16 p-1 text-right text-sm border rounded"
                                                    defaultValue={p.price}
                                                    onBlur={async (e) => {
                                                        const newPrice = parseFloat(e.target.value);
                                                        if (newPrice !== p.price) {
                                                            await updateProductPrice(p.id, newPrice);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
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
    return <span className={`px-2 py-1 rounded text-xs font-bold border ${style}`}>{status}</span>;
}
