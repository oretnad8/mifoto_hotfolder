
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { items, metadata } = body;

        const preference = new Preference(client);

        console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "Loaded" : "Missing");

        const result = await preference.create({
            body: {
                items: items,
                back_urls: {
                    success: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/status`,
                    failure: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/status`,
                    pending: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/status`,
                },
                // auto_return: 'approved',
                metadata: metadata,
                // notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/mercadopago`,
            },
        });

        console.log("Mercado Pago Response:", JSON.stringify(result, null, 2));

        if (!result.init_point) {
            console.error("Error: init_point is missing in response");
            return NextResponse.json({ error: "No init_point in MP response", raw: result }, { status: 500 });
        }

        return NextResponse.json({
            init_point: result.init_point,
            preferenceId: result.id,
        });
    } catch (error) {
        console.error('Error creating preference:', error);
        return NextResponse.json({ error: 'Error creating preference' }, { status: 500 });
    }
}
