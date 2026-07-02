import { ImageResponse } from "next/og";

import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const alt = `${BRAND_NAME} marketplace`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "radial-gradient(circle at 20% 15%, rgba(216,121,50,0.28), transparent 35%), radial-gradient(circle at 80% 10%, rgba(215,255,95,0.12), transparent 30%), #120f0a",
          color: "#f4eee2",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: "0.35em", color: "#d87932" }}>
          {BRAND_NAME.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            A fair market for generative art
          </div>
          <div style={{ marginTop: 24, fontSize: 30, color: "#cfc2ad" }}>
            {BRAND_TAGLINE}
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#d7ff5f" }}>
          0% marketplace fees · Arbitrum
        </div>
      </div>
    ),
    size,
  );
}
