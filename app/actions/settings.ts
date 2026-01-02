"use server";

import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import axios from "axios";

const LICENSE_SERVER_BASE_URL = "http://dantero.ddns.net:3333";

export async function saveValidationSettings(data: {
    clientLogoUrl?: string;
    welcomeText?: string;
    validatorPassword?: string;
}) {
    console.log(">>>>>>>> [Settings Action] CALLED. Data received:", JSON.stringify(data, null, 2));

    let brandingLogoPath = undefined;

    // Handle Logo Download
    if (data.clientLogoUrl && data.clientLogoUrl.trim() !== "") {
        try {
            const fullUrl = `${LICENSE_SERVER_BASE_URL}${data.clientLogoUrl.startsWith('/') ? '' : '/'}${data.clientLogoUrl}`;
            console.log("[Settings Action] Downloading logo from:", fullUrl);

            const response = await axios.get(fullUrl, { responseType: "arraybuffer" });
            const buffer = Buffer.from(response.data);

            const fileName = path.basename(data.clientLogoUrl);
            const publicAssetsDir = path.join(process.cwd(), "public", "assets", "branding");

            await fs.mkdir(publicAssetsDir, { recursive: true });

            const localFilePath = path.join(publicAssetsDir, fileName);
            await fs.writeFile(localFilePath, buffer);

            brandingLogoPath = `/assets/branding/${fileName}`;
            console.log("[Settings Action] Logo saved to:", brandingLogoPath);
        } catch (error: any) {
            console.error("[Settings Action] Failed to download logo:", error.message);
            // We don't fail the whole process if logo download fails, just log it.
        }
    }

    // Update DB
    try {
        await (prisma as any).kioskConfig.upsert({
            where: { id: 1 },
            update: {
                brandingLogoPath: brandingLogoPath, // strictly update if we have one, or maybe we should clear it if url is empty?
                // User said: "Si existe, muestra esta imagen". If user removes it on server, maybe we should clear. 
                // But for now, if data.clientLogoUrl is provided we update. 
                // If it's undefined (not sent), we leave it.
                // If it's sent, we update.
                ...(brandingLogoPath !== undefined ? { brandingLogoPath } : {}),
                brandingWelcomeText: data.welcomeText,
                validatorPassword: data.validatorPassword,
            },
            create: {
                id: 1,
                brandingLogoPath: brandingLogoPath,
                brandingWelcomeText: data.welcomeText,
                validatorPassword: data.validatorPassword,
            },
        });
        console.log("[Settings Action] Database updated successfully.");
        return { success: true };
    } catch (error: any) {
        console.error("[Settings Action] Database update failed:", error);
        return { success: false, error: error.message };
    }
}

export async function getBrandingSettings() {
    try {
        const config = await (prisma as any).kioskConfig.findFirst({
            where: { id: 1 },
            select: {
                brandingLogoPath: true,
                brandingWelcomeText: true
            }
        });
        return config;
    } catch (error) {
        console.error("Failed to fetch branding settings:", error);
        return null;
    }
}
