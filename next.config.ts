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
        hostname: "api.randomwalknft.com",
        port: "1443",
      },
      {
        protocol: "https",
        hostname: "nfts.randomwalknft.com",
      },
      {
        protocol: "https",
        hostname: "cosmicsignature.com",
      },
      {
        protocol: "https",
        hostname: "app.cosmicsignature.com",
      },
      {
        protocol: "https",
        hostname: "nfts.cosmicsignature.com",
      },
    ],
  },
};

export default nextConfig;
