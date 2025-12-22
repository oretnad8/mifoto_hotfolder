import { prisma } from '@/lib/db';
import ValidateButton from './ValidateButton';
import AutoRefresh from '../components/AutoRefresh';
import { Order } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    // Fetch ALL orders to ensure we see everything
    const allOrders: Order[] = await prisma.order.findMany({
        orderBy: {
            createdAt: 'desc',
        },
    });

    return (
        <div className="min-h-screen bg-white text-[#2D3A52] p-8">
            <AutoRefresh intervalMs={5000} />
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-4xl font-bold text-[#2D3A52]">
                            Validador
                        </h1>
                        <p className="text-[#2D3A52]/70 mt-2 text-lg">Gestión de órdenes y validación de pagos</p>
                    </div>
                    <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] px-6 py-3 rounded-2xl border border-white/50 text-sm shadow-sm">
                        Total Órdenes: <span className="font-bold text-[#D75F1E] text-lg ml-1">{allOrders.length}</span>
                    </div>
                </header>

                <div className="grid gap-6">
                    {allOrders.length === 0 ? (
                        <div className="bg-gradient-to-r from-[#CEDFE7] to-[#FCF4F3] rounded-2xl p-12 text-center shadow-lg">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <i className="ri-inbox-line text-4xl text-[#D75F1E]"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[#2D3A52] mb-2">No hay órdenes registradas</h3>
                            <p className="text-[#2D3A52]/70">Las nuevas órdenes aparecerán automáticamente aquí.</p>
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
                                            <th className="p-6 font-semibold">Total</th>
                                            <th className="p-6 font-semibold text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2D3A52]/10">
                                        {allOrders.map((order) => {
                                            const client = order.client as any;
                                            const isPendingTransfer = order.status === 'pending' && order.paymentMethod === 'transfer';

                                            return (
                                                <tr key={order.id} className="hover:bg-[#2D3A52]/5 transition-colors group">
                                                    <td className="p-6">
                                                        <div className="font-mono text-[#D75F1E] font-bold text-lg">#{order.id.slice(0, 8)}</div>
                                                        <div className="text-xs text-[#2D3A52]/60 mt-1 flex items-center gap-1">
                                                            <i className="ri-time-line"></i>
                                                            {new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString()}
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="font-bold text-[#2D3A52]">{client?.name || 'Invitado'}</div>
                                                        <div className="text-xs text-[#2D3A52]/60">{client?.email}</div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize
                                                            ${order.paymentMethod === 'transfer'
                                                                ? 'bg-[#D75F1E]/10 text-[#D75F1E]'
                                                                : 'bg-[#2D3A52]/10 text-[#2D3A52]'}`}>
                                                            {order.paymentMethod === 'transfer' ? 'Transferencia' : order.paymentMethod}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        <StatusBadge status={order.status} />
                                                    </td>
                                                    <td className="p-6 font-bold text-[#2D3A52] text-lg">
                                                        ${order.total.toLocaleString('es-CL')}
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        {isPendingTransfer ? (
                                                            <ValidateButton orderId={order.id} />
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2D3A52]/40 bg-[#2D3A52]/5 px-3 py-1 rounded-full">
                                                                {order.status === 'validated' && <i className="ri-check-double-line"></i>}
                                                                {order.status === 'validated' ? 'Completado' : 'Sin acciones'}
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
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        validated: 'bg-[#CEDFE7] text-[#2D3A52] border-[#2D3A52]/10',
        cancelled: 'bg-red-100 text-red-700 border-red-200',
    };

    const style = styles[status] || 'bg-gray-100 text-gray-600 border-gray-200';
    const label = {
        pending: 'Pendiente',
        paid: 'Pagado',
        validated: 'Validado',
        cancelled: 'Cancelado'
    }[status] || status;

    return (
        <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${style} inline-flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'validated' ? 'bg-[#2D3A52]' : 'bg-current'}`}></span>
            {label}
        </span>
    );
}
