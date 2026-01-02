
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMpAccessToken } from '@/lib/mp-config';

export async function POST(req: NextRequest) {
    try {
        const accessToken = await getMpAccessToken();
        const client = new MercadoPagoConfig({ accessToken: accessToken });

        const body = await req.json();
        const { type, data } = body;

        if (type === 'payment') {
            console.log('Payment notification received:', data.id);

            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: data.id });

            // Extract order ID from metadata
            const orderId = paymentInfo.metadata?.order_id;

            if (paymentInfo.status === 'approved' && orderId) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'paid',
                        paymentMethod: 'mercadopago',
                        paymentReference: data.id,
                    }
                });
                console.log(`Order ${orderId} marked as paid.`);
            }
        }

        return NextResponse.json({}, { status: 200 });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }
}
