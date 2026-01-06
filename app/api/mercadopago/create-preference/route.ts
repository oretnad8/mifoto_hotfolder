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

        // Detección Dinámica del Host
        // PRIORITY: Configured Subdomain from Database
        // This ensures both Electron and Mobile use the correct public HTTPS URL for callbacks
        let sanitizedBaseUrl = '';

        try {
            // We can import prisma dynamically or top-level. 
            // Since this is a server route, top level or inline is fine.
            const { prisma } = await import('@/lib/db');
            const kioskConfig = await prisma.kioskConfig.findFirst();

            console.log('[MP] Database Config:', kioskConfig ? `Found (ID: ${kioskConfig.id})` : 'Not Found');
            if (kioskConfig?.subdomain) {
                console.log('[MP] Found subdomain in DB:', kioskConfig.subdomain);
                sanitizedBaseUrl = `https://${kioskConfig.subdomain}.localfoto.cl`;
                console.log(`[MP] Using configured subdomain: ${sanitizedBaseUrl}`);
            }
        } catch (e) {
            console.error('[MP] Failed to check subdomain config:', e);
        }

        // Fallback: Request Headers
        if (!sanitizedBaseUrl) {
            const origin = req.headers.get('origin');
            const host = req.headers.get('host');
            const protocol = req.headers.get('x-forwarded-proto') || 'https';

            sanitizedBaseUrl = origin || '';

            if (!sanitizedBaseUrl && host) {
                sanitizedBaseUrl = `${protocol}://${host}`;
            }
        }

        // Fallback: ENV
        if (!sanitizedBaseUrl) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            if (baseUrl) sanitizedBaseUrl = baseUrl;
        }

        // Final Fallback: Localhost replacement for testing
        if (!sanitizedBaseUrl) sanitizedBaseUrl = 'http://localhost:3000';

        // Localhost replacement for mobile access (only if we didn't force subdomain)
        if (sanitizedBaseUrl.includes('localhost') || sanitizedBaseUrl.includes('127.0.0.1')) {
            const localIp = getLocalIp();
            sanitizedBaseUrl = sanitizedBaseUrl.replace('localhost', localIp).replace('127.0.0.1', localIp);
            console.log(`Environment: LOCAL DEV (Replacing localhost with ${localIp})`);
        } else {
            // Only log if not already logged above
            if (!sanitizedBaseUrl.includes('.localfoto.cl')) {
                console.log(`Environment: PRODUCTION (URL: ${sanitizedBaseUrl})`);
            }
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
        console.log("Using Access Token (Partial):", accessToken ? `${accessToken.substring(0, 15)}...${accessToken.slice(-4)}` : 'NONE');

        const preference = new Preference(client);

        // @ts-ignore
        const preferenceData: any = {
            items: items,
            payer: {
                name: metadata?.customerName || 'Cliente'
            },
            external_reference: external_reference, // Add Order ID here
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl,
            },
            auto_return: 'all',
            // binary_mode: true, // REMOVED: Likely causing 403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES
            metadata: metadata,
        };

        console.log("Preference Payload:", JSON.stringify(preferenceData, null, 2));

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
    } catch (error: any) {
        console.error('Error creating preference:', error);
        if (error.cause) console.error('Error Cause:', JSON.stringify(error.cause, null, 2));
        if (error.response) {
            console.error('MP Error Response Status:', error.response.status);
            console.error('MP Error Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        return NextResponse.json({
            error: 'Error creating preference',
            details: error.message,
            mp_error: error.response?.data || error.cause
        }, { status: 500 });
    }
}
