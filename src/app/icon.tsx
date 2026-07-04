import { ImageResponse } from "next/og";

import { brandIconElement } from "@/lib/brand-icon";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(brandIconElement({ markSize: size.width }), size);
}
