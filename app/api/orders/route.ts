import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { moveOrderFilesToHotFolder } from '@/lib/file-service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { client, paymentMethod, total, items, status } = body;

        // Validate required fields
        if (!client || !items || !total) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // items should be the cart items with size and photos (containing temp filenames)

        // Calculate next order number
        const lastOrder = await prisma.order.findFirst({
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true }
        });
        const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;

        const order = await prisma.order.create({
            data: {
                client: JSON.stringify(client), // Store as string
                paymentMethod,
                total,
                items: JSON.stringify(items), // Store as string
                status: status || 'pending',
                orderNumber: nextOrderNumber,
            },
        });

        // Trigger file move asynchronously (fire and forget to not block UI resonse, or await if critical)
        // User requirements imply "The system copies...", usually we want to confirm it started.
        // Awaiting it ensures we catch immediate errors, but might slow down the "Order Placed" screen.
        // However, for a Kiosk, robust feedback is better.
        // Let's await it to ensure we don't return success if the file copy fails immediately?
        // Actually, if file copy fails, the order is still "Created" in DB.
        // Let's fire and forget but log, or just await since local FS is fast.

        // Trigger file move ONLY if status is 'paid' (or confirmed)
        // For mobile flow, we create 'pending_payment' first, then confirm later.
        if (order.status === 'paid') {
            try {
                await moveOrderFilesToHotFolder(order.id);
            } catch (copyError) {
                console.error("Warning: Order created but file copy failed", copyError);
            }
        } else {
            console.log(`Order ${order.orderNumber} created with status ${order.status}. Waiting for payment to move files.`);
        }

        return NextResponse.json({ success: true, orderId: order.id, orderNumber: order.orderNumber });
    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json({ error: 'Error processing order' }, { status: 500 });
    }
}
