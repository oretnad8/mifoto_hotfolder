const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Verifying Products Table ---');

    // 1. Check if products exist (Seeding check)
    const products = await prisma.product.findMany();
    console.log(`Found ${products.length} products.`);

    if (products.length === 0) {
        console.log('No products found! Attempting data seed via actions logic simulation...');
        // Simulate what getProducts does if empty
        const INITIAL_PRODUCTS = [
            { sku: 'kiosco', name: 'Foto Kiosco', description: '10x15 cm', price: 10, width: 15, height: 10 },
            { sku: 'medium', name: 'Foto Kiosco', description: '13x18 cm', price: 15, width: 18, height: 13 },
        ];
        for (const p of INITIAL_PRODUCTS) {
            await prisma.product.create({ data: p });
        }
        console.log('Seeded test products.');
    } else {
        products.forEach(p => {
            console.log(`- ${p.sku}: $${p.price} (${p.description})`);
        });
    }

    // 2. Test Price Update
    const targetSku = 'kiosco';
    const targetProduct = await prisma.product.findUnique({ where: { sku: targetSku } });

    if (targetProduct) {
        const newPrice = targetProduct.price + 1; // Increment price
        console.log(`\nTesting update: Changing ${targetSku} price from ${targetProduct.price} to ${newPrice}...`);

        await prisma.product.update({
            where: { id: targetProduct.id },
            data: { price: newPrice }
        });

        const updatedProduct = await prisma.product.findUnique({ where: { sku: targetSku } });
        console.log(`New price is: $${updatedProduct.price}`);

        if (updatedProduct.price === newPrice) {
            console.log('SUCCESS: Price update verified.');
        } else {
            console.error('FAILURE: Price did not update.');
        }

        // Revert change to keep it clean (optional, keeping it shows persistence)
        // await prisma.product.update({ where: { id: targetProduct.id }, data: { price: targetProduct.price } });
    } else {
        console.error(`Product ${targetSku} not found to test update.`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
