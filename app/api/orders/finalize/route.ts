import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { moveOrderFilesToHotFolder } from '@/lib/file-service';
import fs from 'fs';
import path from 'path';

function getKioskConfig() {
    try {
        // En Windows el config.json suele estar en APPDATA
        const appData = process.env.APPDATA;
        if (appData) {
            const configPath = path.join(appData, 'mifoto-hotfolder', 'config.json');
            if (fs.existsSync(configPath)) {
                const fileContent = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(fileContent);
                return {
                    name: config.kioskName || 'Kiosco Mifoto',
                    address: config.kioskAddress || 'Sucursal Principal'
                };
            }
        }
    } catch (e) {
        console.warn('Failed to read kiosk config:', e);
    }

    return { name: 'Kiosco Mifoto', address: 'Sucursal Principal' };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { orderId } = body;

        console.log('[Orders] Finalizing order:', orderId);

        if (!orderId) {
            return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Configuration for response (always needed regardless of status)
        const kioskConfig = getKioskConfig();

        // If already paid, return success (idempotency)
        if (order.status === 'paid') {
            return NextResponse.json({
                success: true,
                order: {
                    ...order,
                    kiosk: kioskConfig
                },
                alreadyPaid: true
            });
        }

        console.log('[Orders] Updating status to paid for order:', order.orderNumber);

        // Update status to paid
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'paid'
            }
        });

        // Trigger file move
        try {
            console.log('[Orders] Moving files to hot folder...');
            await moveOrderFilesToHotFolder(order.id);
            console.log('[Orders] Files moved successfully');
        } catch (copyError) {
            console.error("Warning: Order finalized but file copy failed", copyError);
        }

        return NextResponse.json({
            success: true,
            order: {
                ...updatedOrder,
                kiosk: kioskConfig
            }
        });

    } catch (error) {
        console.error('Error finalizing order:', error);
        return NextResponse.json({ error: 'Error finalizing order' }, { status: 500 });
    }
}
