import { createElement, type ReactElement } from "react";

export const ICON_COPPER = "#d87932";
export const ICON_INK = "#120f0a";

/**
 * The monogram is drawn as vector paths instead of text so every renderer
 * (browser SVG, satori/resvg PNG rasterization, ICO) produces the exact same
 * bold letterforms without depending on font availability.
 *
 * Geometry lives in a 512x512 viewBox: a copper disc of radius 240 centered
 * at (256,256) with an "AZ" cap band from y=161 to y=351.
 */
const A_PATH =
  "M140 161 L200 161 L250 351 L208 351 L195 303 L145 303 L132 351 L90 351 Z " +
  "M170 207 L184 261 L156 261 Z";

const Z_PATH =
  "M282 161 L422 161 L422 203 L340 309 L422 309 L422 351 " +
  "L282 351 L282 309 L364 203 L282 203 Z";

type BrandIconSvgOptions = {
  /** Draw the copper disc behind the monogram. Defaults to true. */
  withCircle?: boolean;
};

export function brandIconSvg({ withCircle = true }: BrandIconSvgOptions = {}) {
  const circle = withCircle
    ? `<circle cx="256" cy="256" r="240" fill="${ICON_COPPER}"/>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
    circle +
    `<path fill="${ICON_INK}" fill-rule="evenodd" d="${A_PATH}"/>` +
    `<path fill="${ICON_INK}" d="${Z_PATH}"/>` +
    `</svg>`
  );
}

export function brandIconDataUri(options: BrandIconSvgOptions = {}) {
  return `data:image/svg+xml,${encodeURIComponent(brandIconSvg(options))}`;
}

type BrandIconElementOptions = {
  /** Rendered width/height of the mark inside the canvas, in px. */
  markSize: number;
  /** Opaque tile color behind the mark. Omit for a transparent canvas. */
  tileColor?: string;
  /** Draw the copper disc behind the monogram. Defaults to true. */
  withCircle?: boolean;
};

/**
 * Element tree consumed by `ImageResponse` (satori). The mark is embedded as
 * an SVG data URI image so the PNG outputs match `icon.svg` exactly.
 */
export function brandIconElement({
  markSize,
  tileColor,
  withCircle = true,
}: BrandIconElementOptions): ReactElement {
  return createElement(
    "div",
    {
      style: {
        alignItems: "center",
        backgroundColor: tileColor ?? "transparent",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      },
    },
    createElement("img", {
      src: brandIconDataUri({ withCircle }),
      width: markSize,
      height: markSize,
    }),
  );
}
