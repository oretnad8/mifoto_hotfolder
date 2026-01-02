import { prisma } from '@/lib/db';
import ValidatorDashboard from './ValidatorDashboard';

export const dynamic = 'force-dynamic';

export default async function ValidatorPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const params = await searchParams; // Await the promise for Next.js 15
    const page = parseInt(params.page || '1');
    const limit = 20;

    const totalOrders = await prisma.order.count();
    const totalPages = Math.ceil(totalOrders / limit);

    const initialOrders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });

    return (
        <ValidatorDashboard
            initialOrders={initialOrders}
            totalOrders={totalOrders}
            page={page}
            totalPages={totalPages}
        />
    );
}
