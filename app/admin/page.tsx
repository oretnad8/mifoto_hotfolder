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
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
            <AutoRefresh intervalMs={5000} />
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                            Panel de Control
                        </h1>
                        <p className="text-slate-400 mt-2">Gestión de órdenes y validación de pagos</p>
                    </div>
                    <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-sm">
                        Total Órdenes: <span className="font-bold text-white">{allOrders.length}</span>
                    </div>
                </header>

                <div className="grid gap-6">
                    {allOrders.length === 0 ? (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center backdrop-blur-sm">
                            <div className="text-6xl mb-4">📭</div>
                            <h3 className="text-xl font-medium text-white">No hay órdenes registradas</h3>
                            <p className="text-slate-400">Las nuevas órdenes aparecerán aquí.</p>
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-700 bg-slate-800/80 text-xs uppercase tracking-wider text-slate-400">
                                            <th className="p-4 font-semibold">ID / Fecha</th>
                                            <th className="p-4 font-semibold">Cliente</th>
                                            <th className="p-4 font-semibold">Método</th>
                                            <th className="p-4 font-semibold">Estado</th>
                                            <th className="p-4 font-semibold">Total</th>
                                            <th className="p-4 font-semibold text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {allOrders.map((order) => {
                                            const client = order.client as any;
                                            const isPendingTransfer = order.status === 'pending' && order.paymentMethod === 'transfer';

                                            return (
                                                <tr key={order.id} className="hover:bg-slate-700/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-mono text-blue-400 font-bold">#{order.id.slice(0, 8)}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {new Date(order.createdAt).toLocaleDateString()} • {new Date(order.createdAt).toLocaleTimeString()}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-white">{client?.name || 'Invitado'}</div>
                                                        <div className="text-xs text-slate-400">{client?.email}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                              ${order.paymentMethod === 'transfer' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                                            {order.paymentMethod}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <StatusBadge status={order.status} />
                                                    </td>
                                                    <td className="p-4 font-semibold text-emerald-400">
                                                        ${order.total.toLocaleString('es-CL')}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {isPendingTransfer ? (
                                                            <ValidateButton orderId={order.id} />
                                                        ) : (
                                                            <span className="text-xs text-slate-500 italic">
                                                                {order.status === 'validated' ? 'Validado' : 'Sin acciones'}
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
        pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        validated: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    const style = styles[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    const label = { pending: 'Pendiente', paid: 'Pagado', validated: 'Validado', cancelled: 'Cancelado' }[status] || status;

    return (
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${style}`}>
            {label}
        </span>
    );
}
