import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { moveOrderFilesToHotFolder } from '@/lib/file-service';

// Mock function to fetch payment from MP (requires Access Token)
// In a real app, use 'mercadopago' SDK
async function getPaymentFromMercadoPago(paymentId: string) {
    // Placeholder: return a mock or fetch if token exists
    // Returning dummy data for now as logic structure
    return {
        status: 'approved',
        external_reference: null // This usually comes from MP
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // MP sends { type: 'payment', data: { id: '...' } }

        // If query param has 'topic' or 'type'
        const url = new URL(request.url);
        const topic = url.searchParams.get('topic') || body?.type;
        const paymentId = url.searchParams.get('id') || body?.data?.id;

        if (topic === 'payment' && paymentId) {
            // Here we would fetch the payment status from MP API
            // const payment = await mercadopago.payment.findById(paymentId);

            // For this implementation, I will assume the 'external_reference' 
            // is passed in the URL (if notification_url was set with ?orderId=...)
            // OR we'll trust the logic that if we get a payment notification, we try to match it.

            // NOTE: Without MP Access Token, we cannot verify the payment status securely.
            // Strategy: Look for orderId in query params if the user sets notification_url to /api/webhook/mercadopago?orderId=...

            const orderId = url.searchParams.get('source_news'); // unlikely

            // Let's rely on query param 'orderId' if the frontend sets it in the preference 'notification_url'
            const externalRef = url.searchParams.get('external_reference');

            if (externalRef) {
                await prisma.order.update({
                    where: { id: externalRef },
                    data: { status: 'paid', paymentReference: paymentId.toString() }
                });
                await moveOrderFilesToHotFolder(externalRef);
            } else {
                console.log('Webhook received but no external_reference found (requires MP SDK integration)');
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
