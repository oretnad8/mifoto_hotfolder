import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Widen window to 24 hours to catch older orders during testing/long sessions
        const lookbackWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const pendingOrders = await prisma.order.findMany({
            where: {
                status: {
                    in: ['pending', 'pending_payment']
                },
                createdAt: {
                    gte: lookbackWindow,
                },
            },
            select: {
                id: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5, // Process only the 5 most recent orders to avoid flooding
        });

        console.log(`[Polling] Found ${pendingOrders.length} pending orders since ${lookbackWindow.toISOString()}`);
        return NextResponse.json({ orders: pendingOrders });
    } catch (error) {
        console.error('Error fetching pending orders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending orders' },
            { status: 500 }
        );
    }
}
