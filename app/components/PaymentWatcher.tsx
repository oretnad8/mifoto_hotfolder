'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentWatcher() {
    const router = useRouter();

    useEffect(() => {
        // Check if we are in Electron. 
        // Usually exposed via contextBridge as window.electron or found in user agent.
        // The user mentioned "detection window.electron or similar".
        const isElectron = typeof window !== 'undefined' && (window as any).electron;

        if (!isElectron) {
            // If not in Electron (e.g. user's mobile), do not run the poller
            return;
        }

        const POLLING_INTERVAL = 8000; // 8 seconds

        // Recursive polling function
        const runPollingLoop = async () => {
            // 1. Get pending orders
            try {
                const res = await fetch('/api/orders/pending');
                if (res.ok) {
                    const data = await res.json();
                    const orders = data.orders || [];

                    if (orders.length > 0) {
                        console.log(`[PaymentWatcher] Checking ${orders.length} pending orders...`);

                        // 2. Check each pending order SEQUENTIALLY with a small delay to avoid burst log noise
                        for (const order of orders) {
                            try {
                                // Add 1 second delay between checks
                                await new Promise(resolve => setTimeout(resolve, 1000));

                                const checkRes = await fetch('/api/orders/check-payment', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ orderId: order.id }),
                                });

                                if (checkRes.ok) {
                                    const checkData = await checkRes.json();
                                    if (checkData.status === 'paid' && checkData.processed) {
                                        console.log(`[PaymentWatcher] Order ${order.id} PAID! Refreshing UI.`);
                                        router.refresh();
                                    }
                                }
                            } catch (err) {
                                // Ignore error
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("[PaymentWatcher] Network error", error);
            }

            // Schedule next run ONLY after current run finishes
            timeoutId = setTimeout(runPollingLoop, POLLING_INTERVAL);
        };

        let timeoutId = setTimeout(runPollingLoop, POLLING_INTERVAL);

        // Cleanup
        return () => clearTimeout(timeoutId);
    }, [router]);

    // This is a background service component, renders nothing
    return null;
}
