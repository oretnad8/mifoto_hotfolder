import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '@/lib/db';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });

export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const searchParams = url.searchParams;
        const topic = searchParams.get('topic') || searchParams.get('type');

        // Mercado Pago sends data in query params for some webhooks or body for others
        // Usually v2 uses body but let's handle body primarily
        const body = await request.json().catch(() => ({}));

        const { action, data, type } = body;
        const id = data?.id || searchParams.get('data.id') || searchParams.get('id');

        console.log('Webhook received:', { action, type, id, topic });

        // Check if it's a payment notification
        if (type === 'payment' || topic === 'payment' || action === 'payment.updated' || action === 'payment.created') {
            if (!id) {
                return NextResponse.json({ error: 'No ID found' }, { status: 400 });
            }

            const payment = new Payment(client);
            const paymentData = await payment.get({ id: id });

            console.log('Payment Data Status:', paymentData.status);

            if (paymentData.status === 'approved') {
                const metadata = paymentData.metadata as any;
                const orderId = metadata.order_id; // Mercado Pago converts metadata keys to snake_case

                if (orderId) {
                    await prisma.order.update({
                        where: { id: orderId },
                        data: {
                            status: 'paid', // Update status to paid
                            paymentMethod: 'mercadopago',
                            paymentReference: String(id),
                        },
                    });
                    console.log(`Order ${orderId} updated to paid`);
                } else {
                    console.warn('No order_id in metadata');
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
