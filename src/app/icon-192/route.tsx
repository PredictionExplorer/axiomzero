import { ImageResponse } from "next/og";

import { brandIconElement } from "@/lib/brand-icon";

export const dynamic = "force-static";

const SIZE = 192;

export function GET() {
  return new ImageResponse(brandIconElement({ markSize: SIZE }), {
    width: SIZE,
    height: SIZE,
  });
}
