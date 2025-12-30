import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { items, metadata } = body;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        if (!baseUrl) {
            console.error("NEXT_PUBLIC_BASE_URL is not defined in environment variables");
            return NextResponse.json({ error: "Server configuration error: NEXT_PUBLIC_BASE_URL missing" }, { status: 500 });
        }

        const successUrl = `${baseUrl}/checkout/status`;
        const failureUrl = `${baseUrl}/checkout/status`;
        const pendingUrl = `${baseUrl}/checkout/status`;

        console.log("Using Back URLs:", { success: successUrl, failure: failureUrl, pending: pendingUrl });
        console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "Loaded" : "Missing");

        const preference = new Preference(client);

        const result = await preference.create({
            body: {
                items: items,
                back_urls: {
                    success: successUrl,
                    failure: failureUrl,
                    pending: pendingUrl,
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
            sandbox_init_point: result.sandbox_init_point, // Expose sandbox URL
            preferenceId: result.id,
        });
    } catch (error) {
        console.error('Error creating preference:', error);
        return NextResponse.json({ error: 'Error creating preference' }, { status: 500 });
    }
}
