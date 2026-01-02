const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearConfig() {
    try {
        const updated = await prisma.kioskConfig.update({
            where: { id: 1 },
            data: { brandingWelcomeText: null, brandingLogoPath: null }
        });
        console.log('Cleared KioskConfig:', updated);
    } catch (e) {
        console.error('Error clearing config:', e);
    } finally {
        await prisma.$disconnect();
    }
}

clearConfig();
