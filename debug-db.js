
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const orders = await prisma.order.findMany({
            take: 5,
            orderBy: {
                createdAt: 'desc',
            },
        });
        console.log('Last 5 orders:', JSON.stringify(orders, null, 2));

        // Check count of pending
        const pendingCount = await prisma.order.count({
            where: { status: 'pending' }
        });
        console.log('Total pending orders:', pendingCount);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
