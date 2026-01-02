import { networkInterfaces } from 'os';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
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
        const body = await req.json();
        const { items, metadata, isElectron, external_reference } = body;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        if (!baseUrl) {
            console.error("NEXT_PUBLIC_BASE_URL is not defined in environment variables");
            return NextResponse.json({ error: "Server configuration error: NEXT_PUBLIC_BASE_URL missing" }, { status: 500 });
        }

        let sanitizedBaseUrl;

        if (isElectron) {
            // Electron Native Modal: Use intercepted dummy URL
            sanitizedBaseUrl = 'https://mifoto-hotfolder-dummy.com';
            console.log("Environment: ELECTRON (Using dummy URL)");
        } else {
            // Mobile / Web: Use real public URL (must be accessible from mobile)
            // Replace localhost with actual LAN IP
            const localIp = getLocalIp();
            sanitizedBaseUrl = baseUrl.replace('localhost', localIp).replace('127.0.0.1', localIp);
            console.log(`Environment: MOBILE/WEB (Replacing localhost with ${localIp})`);
        }

        const successUrl = `${sanitizedBaseUrl}/checkout/status`;
        const failureUrl = `${sanitizedBaseUrl}/checkout/status`;
        const pendingUrl = `${sanitizedBaseUrl}/checkout/status`;

        console.log("Using Back URLs (Sanitized/Dummy):", { success: successUrl, failure: failureUrl, pending: pendingUrl });
        console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "Loaded" : "Missing");

        const preference = new Preference(client);

        // @ts-ignore
        // @ts-ignore
        const preferenceData: any = {
            items: items,
            external_reference: external_reference, // Add Order ID here
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl,
            },
            binary_mode: true, // Force immediate decision (approved/rejected)
            metadata: metadata,
        };

        // Only enable auto_return for Electron.
        // Mercado Pago rejects auto_return for local IPs (192.168.x.x) or http.
        if (isElectron) {
            preferenceData.auto_return = 'approved';
        }

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
