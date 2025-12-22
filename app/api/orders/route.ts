import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { client, paymentMethod, total, items, status } = body;

        // Validate required fields
        if (!client || !items || !total) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // items should be the cart items with size and photos (containing temp filenames)

        const order = await prisma.order.create({
            data: {
                client, // JSON
                paymentMethod,
                total,
                items, // JSON
                status: status || 'pending',
            },
        });

        return NextResponse.json({ success: true, orderId: order.id });
    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json({ error: 'Error processing order' }, { status: 500 });
    }
}
