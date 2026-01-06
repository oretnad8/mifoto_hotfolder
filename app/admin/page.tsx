import { prisma } from '@/lib/db';
import ValidateButton from './ValidateButton';
import AutoRefresh from '../components/AutoRefresh';
import PrinterStatusWidget from './PrinterStatusWidget';
import { Order } from '@prisma/client';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    // Resolve searchParams (it can be a Promise in newer Next.js versions)
    const params = await searchParams;

    const page = Number(params?.page) || 1;
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    // Fetch orders with pagination
    const allOrders: Order[] = await prisma.order.findMany({
        orderBy: {
            createdAt: 'desc',
        },
        take: pageSize,
        skip: skip,
    });

    // Get total count for pagination info
    const totalOrders = await prisma.order.count();
    const totalPages = Math.ceil(totalOrders / pageSize);

    return (
        <AdminDashboard
            initialOrders={allOrders}
            totalOrders={totalOrders}
            page={page}
            totalPages={totalPages}
        />
    );
}
