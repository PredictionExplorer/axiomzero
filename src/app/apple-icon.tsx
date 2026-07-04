import { ImageResponse } from "next/og";

import { brandIconElement, ICON_INK } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icons must be fully opaque and full-bleed: iOS composites
// transparent pixels onto black and applies its own corner mask.
export default function AppleIcon() {
  return new ImageResponse(
    brandIconElement({ markSize: 132, tileColor: ICON_INK }),
    size,
  );
}
