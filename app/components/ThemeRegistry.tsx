"use client";

import { useEffect } from "react";

const THEME_COLORS: Record<string, Record<string, string>> = {
    // Default / Orange
    orange: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#f97316',
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12',
        950: '#431407',
    },
    blue: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554',
    },
    green: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
        950: '#052e16',
    },
    purple: {
        50: '#faf5ff',
        100: '#f3e8ff',
        200: '#e9d5ff',
        300: '#d8b4fe',
        400: '#c084fc',
        500: '#a855f7',
        600: '#9333ea',
        700: '#7e22ce',
        800: '#6b21a8',
        900: '#581c87',
        950: '#3b0764',
    },
    red: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
        950: '#450a0a',
    }
};

export default function ThemeRegistry({
    color = "orange",
    children,
}: {
    color?: string;
    children: React.ReactNode;
}) {
    useEffect(() => {
        const root = document.documentElement;
        const safeColor = THEME_COLORS[color] ? color : "orange";
        const palette = THEME_COLORS[safeColor];

        // Apply variables
        Object.entries(palette).forEach(([key, value]) => {
            root.style.setProperty(`--brand-${key}`, value);
        });

    }, [color]);

    // Render children immediately.
    // CSS variables will be applied by useEffect on mount.
    // To avoid FOUC (flash of unstyled content) or flash of wrong color, 
    // we could also inject a style tag, but useEffect is requested/standard for client-side updates.
    return <>{children}</>;
}
