import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export", // Disabled for API/DB support
  images: {
    unoptimized: true,
  },
  typescript: {
    // ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
