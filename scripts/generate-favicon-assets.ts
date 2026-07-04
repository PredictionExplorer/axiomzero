/**
 * Regenerates the committed static favicon assets from src/lib/brand-icon.ts:
 *
 *   - src/app/icon.svg    (scalable favicon for modern browsers)
 *   - src/app/favicon.ico (32x32 PNG-in-ICO legacy fallback)
 *
 * Run with: pnpm icons:generate
 */
import { writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

import { brandIconElement, brandIconSvg } from "../src/lib/brand-icon";

const ICO_SIZE = 32;

/** Wraps a single PNG in an ICO container (ICONDIR + one ICONDIRENTRY). */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // image type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // palette colors (none)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // payload size
  entry.writeUInt32LE(header.length + entry.length, 12); // payload offset

  return Buffer.concat([header, entry, png]);
}

async function main() {
  const svgPath = new URL("../src/app/icon.svg", import.meta.url);
  await writeFile(svgPath, `${brandIconSvg()}\n`);
  console.log("Wrote src/app/icon.svg");

  const response = new ImageResponse(brandIconElement({ markSize: ICO_SIZE }), {
    width: ICO_SIZE,
    height: ICO_SIZE,
  });
  const png = Buffer.from(await response.arrayBuffer());

  const icoPath = new URL("../src/app/favicon.ico", import.meta.url);
  await writeFile(icoPath, pngToIco(png, ICO_SIZE));
  console.log(`Wrote src/app/favicon.ico (${png.length} byte PNG payload)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
