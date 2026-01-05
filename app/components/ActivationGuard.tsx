"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ActivationWizard from "./ActivationWizard";
import { saveValidationSettings } from "@/app/actions/settings";

export default function ActivationGuard({
    children,
}: {
    children: React.ReactNode;
}) {
    const [status, setStatus] = useState<"loading" | "active" | "inactive">("loading");

    const router = useRouter();

    useEffect(() => {
        // Check if running in Electron
        if (typeof window !== "undefined" && window.electron) {
            window.electron
                .getActivationStatus()
                .then(async (res: any) => {
                    if (res.active) {
                        console.log(">>>>>>>> [ActivationGuard] App is active. Syncing settings. Data from Electron:", res);
                        // Sync settings in background
                        try {
                            await saveValidationSettings({
                                clientLogoUrl: res.clientLogoUrl,
                                welcomeText: res.welcomeText,
                                validatorPassword: res.validatorPassword,
                                brandingThemeColor: res.themeColor
                            });
                            console.log("[ActivationGuard] Settings synced. Refreshing...");
                            router.refresh(); // Refresh to apply new theme/settings
                        } catch (err) {
                            console.error("[ActivationGuard] Error syncing settings:", err);
                        }

                        setStatus("active");
                    } else {
                        setStatus("inactive");
                    }
                })
                .catch((err: any) => {
                    console.error("Activation check failed:", err);
                    setStatus("inactive"); // Fail safe to inactive
                });
        } else {
            // Browser environment (dev) - Assume active or allow bypass
            console.log("Not in Electron environment, skipping activation check.");
            setStatus("active");
        }
    }, [router]);

    if (status === "loading") {
        // Splash screen while checking
        return (
            <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500 font-medium">Iniciando sistema...</p>
            </div>
        );
    }

    if (status === "inactive") {
        return <ActivationWizard />;
    }

    return <>{children}</>;
}
