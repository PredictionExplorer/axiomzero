import type { NextConfig } from "next";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
};

/**
 * One image remote pattern per configured API origin. The plural `*_URLS`
 * vars are the comma-separated rotation lists (see
 * `src/lib/server-rotation.ts`); the singular vars are the one-server
 * fallback. Token media may be served from any of them depending on the
 * hourly rotation.
 */
function rotationRemotePatterns(): RemotePattern[] {
  const raw = [
    process.env.RANDOM_WALK_API_URLS,
    process.env.NEXT_PUBLIC_RANDOM_WALK_API_URLS,
    process.env.RANDOM_WALK_API_URL,
    process.env.NEXT_PUBLIC_RANDOM_WALK_API_URL,
    process.env.COSMIC_SIGNATURE_API_URLS,
    process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URLS,
    process.env.COSMIC_SIGNATURE_API_URL,
    process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URL,
  ]
    .filter(Boolean)
    .join(",");
  const patterns: RemotePattern[] = [];
  const seen = new Set<string>();
  for (const origin of raw.split(",")) {
    const trimmed = origin.trim().replace(/\/+$/, "");
    if (!trimmed) {
      continue;
    }
    try {
      const url = new URL(trimmed);
      const key = `${url.protocol}//${url.host}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      patterns.push({
        protocol: url.protocol === "https:" ? "https" : "http",
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
      });
    } catch {
      // Skip malformed origins; the fetch layer surfaces them at runtime.
    }
  }
  return patterns;
}

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
      ...rotationRemotePatterns(),
    ],
  },
};

export default nextConfig;
