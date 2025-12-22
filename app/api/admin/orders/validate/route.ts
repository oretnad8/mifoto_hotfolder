import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { moveOrderFilesToHotFolder } from '@/lib/file-service';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== process.env.ADMIN_TOKEN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }

        const order = await prisma.order.update({
            where: { id: orderId },
            data: { status: 'validated' },
        });

        // Trigger file move
        // We do this asynchronously or await it? 
        // Awaiting ensures we report errors if file move fails.
        await moveOrderFilesToHotFolder(order.id);

        return NextResponse.json({ success: true, message: 'Order validated and files moved' });
    } catch (error) {
        console.error('Error validating order:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
