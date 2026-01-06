"use server";

import { prisma } from "@/lib/db";

// Hardcoded initial data for seeding
const INITIAL_PRODUCTS = [
    {
        sku: 'kiosco',
        name: 'Foto Kiosco',
        description: '10x15 cm (4x6 pulgadas)',
        price: 10,
        width: 15,
        height: 10,
    },
    {
        sku: 'medium',
        name: 'Foto Kiosco',
        description: '13x18 cm (5x7 pulgadas)',
        price: 15,
        width: 18,
        height: 13,
    },
    {
        sku: 'large',
        name: 'Foto Kiosco',
        description: '15x20 cm (6x8 pulgadas)',
        price: 20,
        width: 20,
        height: 15,
    },
    {
        sku: 'square-small',
        name: 'Foto Kiosco',
        description: '13x13 cm (5x5 pulgadas)',
        price: 12,
        width: 13,
        height: 13,
    },
    {
        sku: 'square-large',
        name: 'Foto Kiosco',
        description: '15x15 cm (6x6 pulgadas)',
        price: 18,
        width: 15,
        height: 15,
    }
];

export async function getProducts() {
    try {
        // Cast to any because TS doesn't know about Product model yet due to generate failure
        const productModel = (prisma as any).product;

        const count = await productModel.count();
        console.log(`[Products] Total count in DB: ${count}`);

        if (count === 0) {
            console.log("[Products] DB empty. Seeding...");
            await seedProducts();
        }

        const products = await productModel.findMany({
            where: { active: true }
        });
        console.log(`[Products] Active products found: ${products.length}`);

        // Ensure consistent order, e.g., by price or specific logic if needed
        return products.sort((a: any, b: any) => a.price - b.price);
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return [];
    }
}

async function seedProducts() {
    console.log("Seeding products...");
    const productModel = (prisma as any).product;
    for (const p of INITIAL_PRODUCTS) {
        await productModel.upsert({
            where: { sku: p.sku },
            update: {},
            create: p
        });
    }
}

export async function updateProductPrice(id: string, newPrice: number) {
    try {
        const productModel = (prisma as any).product;
        await productModel.update({
            where: { id },
            data: { price: newPrice }
        });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update price:", error);
        return { success: false, error: error.message };
    }
}
