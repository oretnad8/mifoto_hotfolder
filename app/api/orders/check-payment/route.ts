import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { moveOrderFilesToHotFolder } from '@/lib/file-service';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Initialize Mercado Pago client
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '',
});

export async function POST(req: NextRequest) {
    try {
        const { orderId } = await req.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }

        // 1. Idempotency Check in DB
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true }
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.status === 'paid') {
            return NextResponse.json({ status: 'paid', alreadyProcessed: true });
        }

        // 2. Check status with Mercado Pago
        // We search for payments with this external_reference (orderId) and status 'approved'
        const payment = new Payment(client);

        const searchResult = await payment.search({
            options: {
                external_reference: orderId,
                status: 'approved',
                limit: 1
            }
        });

        const approvedPayment = searchResult.results && searchResult.results.length > 0
            ? searchResult.results[0]
            : null;

        if (approvedPayment) {
            // 3. Process Order (Update DB + Move Files)
            console.log(`Payment confirmed for order ${orderId}. Payment ID: ${approvedPayment.id}`);

            // Transaction to ensure DB integrity
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'paid',
                        paymentReference: approvedPayment.id?.toString() || 'unknown'
                    }
                });
            });

            // Move files outside transaction (filesystem op)
            // If this fails, the order is already 'paid' but files might need manual retry or robust retry logic.
            // Based on instructions, we execute it here.
            try {
                await moveOrderFilesToHotFolder(orderId);
            } catch (fileError) {
                console.error(`Error processing files for order ${orderId}:`, fileError);
                // Note: functionality says "return status: 'paid', processed: true"
                // If file move fails, we might want to flag it, but for now we proceed as 'paid'.
            }

            return NextResponse.json({ status: 'paid', processed: true });
        }

        // Still pending
        return NextResponse.json({ status: 'pending' });

    } catch (error) {
        console.error('Error checking payment:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
