import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomwalknft.com",
      },
      {
        protocol: "https",
        hostname: "cosmicsignature.com",
      },
      {
        protocol: "https",
        hostname: "app.cosmicsignature.com",
      },
    ],
  },
};

export default nextConfig;
