'use server';

import { moveOrderFilesToHotFolder } from '@/lib/file-service';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function validateOrderAction(orderId: string) {
    try {
        console.log(`Validating order ${orderId} via Server Action`);

        // 1. Move files
        await moveOrderFilesToHotFolder(orderId);

        // 2. Update Status
        await prisma.order.update({
            where: { id: orderId },
            data: { status: 'validated' }
        });

        // 3. Revalidate Admin Page
        revalidatePath('/admin');

        return { success: true };
    } catch (error) {
        console.error('Validation error:', error);
        return { success: false, error: 'Failed to validate order' };
    }
}
