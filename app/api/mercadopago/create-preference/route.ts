import { networkInterfaces } from 'os';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import { getMpAccessToken } from '@/lib/mp-config';

function getLocalIp() {
    const interfaces = networkInterfaces();
    const sortedInterfaceNames = Object.keys(interfaces).sort((a, b) => {
        // Prioritize "Wi-Fi" or "Ethernet" names
        const aPriority = (a.toLowerCase().includes('wi-fi') || a.toLowerCase().includes('ethernet')) ? -1 : 1;
        const bPriority = (b.toLowerCase().includes('wi-fi') || b.toLowerCase().includes('ethernet')) ? -1 : 1;
        return aPriority - bPriority;
    });

    for (const name of sortedInterfaceNames) {
        // Skip obvious virtual adapters
        if (name.toLowerCase().includes('vmware') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('wsl')) continue;

        for (const iface of interfaces[name]!) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

export async function POST(req: NextRequest) {
    try {
        const accessToken = await getMpAccessToken();
        const client = new MercadoPagoConfig({ accessToken: accessToken });

        const body = await req.json();
        const { items, metadata, external_reference } = body;

        // Detección Dinámica del Host (Unified for Mobile & Electron)
        const origin = req.headers.get('origin');
        const host = req.headers.get('host');
        const protocol = req.headers.get('x-forwarded-proto') || 'https';

        let sanitizedBaseUrl = origin;

        if (!sanitizedBaseUrl && host) {
            sanitizedBaseUrl = `${protocol}://${host}`;
        }

        // Fallback
        if (!sanitizedBaseUrl) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            if (!baseUrl) {
                // Last resort fallback
                sanitizedBaseUrl = 'http://localhost:3000';
            } else {
                sanitizedBaseUrl = baseUrl;
            }
        }

        // Localhost replacement for mobile access
        if (sanitizedBaseUrl && (sanitizedBaseUrl.includes('localhost') || sanitizedBaseUrl.includes('127.0.0.1'))) {
            const localIp = getLocalIp();
            sanitizedBaseUrl = sanitizedBaseUrl.replace('localhost', localIp).replace('127.0.0.1', localIp);
            console.log(`Environment: LOCAL DEV (Replacing localhost with ${localIp})`);
        } else {
            console.log(`Environment: PRODUCTION (Domain: ${sanitizedBaseUrl})`);
        }

        if (!sanitizedBaseUrl) {
            console.error("Unable to determine Base URL");
            return NextResponse.json({ error: "Server configuration error: Base URL missing" }, { status: 500 });
        }

        console.log(`Dynamic Base URL configured: ${sanitizedBaseUrl}`);

        const successUrl = `${sanitizedBaseUrl}/checkout/status`;
        const failureUrl = `${sanitizedBaseUrl}/checkout/status`;
        const pendingUrl = `${sanitizedBaseUrl}/checkout/status`;

        console.log("Using Back URLs:", { success: successUrl, failure: failureUrl, pending: pendingUrl });
        console.log("MP_ACCESS_TOKEN source:", accessToken === process.env.MP_ACCESS_TOKEN ? "ENV" : "Dynamic Config");

        const preference = new Preference(client);

        // @ts-ignore
        const preferenceData: any = {
            items: items,
            external_reference: external_reference, // Add Order ID here
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl,
            },
            auto_return: 'approved', // Enabled for everyone
            binary_mode: true, // Enabled for everyone
            metadata: metadata,
        };

        const result = await preference.create({
            body: preferenceData,
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
