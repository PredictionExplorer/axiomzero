import { ImageResponse } from "next/og";

import { brandIconElement, ICON_COPPER } from "@/lib/brand-icon";

export const dynamic = "force-static";

const SIZE = 512;

// Maskable icons are full-bleed: the launcher crops them to its own shape,
// so the copper fills the canvas and the monogram stays inside the central
// safe zone (a circle spanning 80% of the icon).
export function GET() {
  return new ImageResponse(
    brandIconElement({
      markSize: 460,
      tileColor: ICON_COPPER,
      withCircle: false,
    }),
    { width: SIZE, height: SIZE },
  );
}
