const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const TEMP_DIR = path.join(__dirname, 'temp_uploads');

async function main() {
    try {
        console.log('--- SYSTEM RESET STARTED ---');

        // 1. Delete All Orders
        const deleteOrders = await prisma.order.deleteMany({});
        console.log(`✅ Deleted ${deleteOrders.count} orders.`);

        // 2. Reset Sequence
        // SQLite uses sqlite_sequence table to track autoincrements.
        try {
            await prisma.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name='orders';");
            console.log('✅ Reset order sequence (sqlite_sequence).');
        } catch (e) {
            console.warn('⚠️ Could not reset sqlite_sequence (might check if table name is correct or if it exists):', e.message);
        }

        // 3. Clear Temp Files
        if (fs.existsSync(TEMP_DIR)) {
            const files = fs.readdirSync(TEMP_DIR);
            let deletedCount = 0;
            for (const file of files) {
                if (file === '.gitkeep') continue; // Preserve .gitkeep
                try {
                    fs.unlinkSync(path.join(TEMP_DIR, file));
                    deletedCount++;
                } catch (err) {
                    console.error(`❌ Failed to delete ${file}:`, err.message);
                }
            }
            console.log(`✅ Deleted ${deletedCount} temp files.`);
        } else {
            console.log('ℹ️ Temp directory not found, skipping cleanup.');
        }

        // 4. Reset License (Clear electron-store config)
        try {
            const appData = process.env.APPDATA;
            if (appData) {
                const configPath = path.join(appData, 'mifoto-hotfolder', 'config.json');
                if (fs.existsSync(configPath)) {
                    console.log(`Found config at: ${configPath}`);
                    const configStr = fs.readFileSync(configPath, 'utf-8');
                    let config = {};
                    try {
                        config = JSON.parse(configStr);
                    } catch (e) {
                        console.warn('⚠️ Config file is invalid JSON, resetting completely.');
                    }

                    // Remove License Key to force re-activation
                    if (config.licenseKey) {
                        delete config.licenseKey;
                        // Also clear adminPassword to be safe/clean? User said "solicite la licencia nuevamente"
                        // Usually cleaning both is better for "Factory Reset" feel.
                        if (config.adminPassword) delete config.adminPassword;

                        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
                        console.log('✅ Cleared License Key from configuration.');
                    } else {
                        console.log('ℹ️ No license key found in config to clear.');
                    }
                } else {
                    console.log('ℹ️ No config.json found in AppData (maybe strictly fresh install).');
                }
            }
        } catch (e) {
            console.error('❌ Failed to reset license:', e.message);
        }

        console.log('--- SYSTEM RESET COMPLETE ---');

    } catch (error) {
        console.error('❌ Error during reset:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
