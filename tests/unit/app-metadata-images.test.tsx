import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";
import type { CSSProperties, ReactElement } from "react";

const imageResponseMock = vi.hoisted(() => ({
  calls: [] as Array<{ element: ReactElement; options: unknown }>,
}));

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: ReactElement, options: unknown) {
      imageResponseMock.calls.push({ element, options });
    }
  },
}));

import Icon, {
  size as iconSize,
  contentType as iconContentType,
} from "@/app/icon";
import AppleIcon, {
  size as appleIconSize,
  contentType as appleIconContentType,
} from "@/app/apple-icon";
import {
  GET as getIcon192,
  dynamic as icon192Dynamic,
} from "@/app/icon-192/route";
import {
  GET as getIconMaskable,
  dynamic as iconMaskableDynamic,
} from "@/app/icon-maskable/route";
import OpenGraphImage, {
  alt as ogAlt,
  size as ogSize,
  contentType as ogContentType,
} from "@/app/opengraph-image";
import { BRAND_NAME } from "@/lib/brand";
import {
  brandIconDataUri,
  brandIconSvg,
  ICON_COPPER,
  ICON_INK,
} from "@/lib/brand-icon";

type ImageProps = { src: string; width: number; height: number };

function childrenOf(element: ReactElement): ReactElement[] {
  const { children } = element.props as {
    children?: ReactElement | ReactElement[] | string;
  };

  if (!children || typeof children === "string") {
    return [];
  }
  return Array.isArray(children) ? children : [children];
}

function textContent(element: ReactElement): string {
  const { children } = element.props as {
    children?: ReactElement | ReactElement[] | string;
  };

  if (typeof children === "string") {
    return children;
  }
  return childrenOf(element)
    .map((child) => (typeof child === "string" ? child : textContent(child)))
    .join(" ");
}

function findImages(element: ReactElement): ImageProps[] {
  const own = element.type === "img" ? [element.props as ImageProps] : [];
  return [...own, ...childrenOf(element).flatMap(findImages)];
}

function rootStyle(element: ReactElement): CSSProperties {
  return (element.props as { style: CSSProperties }).style;
}

function decodeSvgDataUri(src: string): string {
  return decodeURIComponent(src.replace("data:image/svg+xml,", ""));
}

describe("app metadata images", () => {
  it("renders the favicon as a copper disc monogram on transparency", () => {
    Icon();

    const call = imageResponseMock.calls.at(-1);
    expect(call?.options).toEqual(iconSize);
    expect(iconSize).toEqual({ width: 512, height: 512 });
    expect(iconContentType).toBe("image/png");
    expect(rootStyle(call!.element).backgroundColor).toBe("transparent");

    const [mark] = findImages(call!.element);
    expect(mark).toEqual({ src: brandIconDataUri(), width: 512, height: 512 });

    const svg = decodeSvgDataUri(mark.src);
    expect(svg).toContain(
      `<circle cx="256" cy="256" r="240" fill="${ICON_COPPER}"/>`,
    );
    expect(svg).toContain(`fill="${ICON_INK}"`);
  });

  it("renders the apple touch icon as an opaque full-bleed tile", () => {
    AppleIcon();

    const call = imageResponseMock.calls.at(-1);
    expect(call?.options).toEqual(appleIconSize);
    expect(appleIconSize).toEqual({ width: 180, height: 180 });
    expect(appleIconContentType).toBe("image/png");

    // iOS composites transparency onto black and rounds corners itself, so
    // the tile must stay opaque and unrounded.
    const style = rootStyle(call!.element);
    expect(style.backgroundColor).toBe(ICON_INK);
    expect(style.borderRadius).toBeUndefined();

    const [mark] = findImages(call!.element);
    expect(mark).toEqual({ src: brandIconDataUri(), width: 132, height: 132 });
  });

  it("serves a statically generated 192px PWA icon", () => {
    getIcon192();

    const call = imageResponseMock.calls.at(-1);
    expect(icon192Dynamic).toBe("force-static");
    expect(call?.options).toEqual({ width: 192, height: 192 });
    expect(rootStyle(call!.element).backgroundColor).toBe("transparent");

    const [mark] = findImages(call!.element);
    expect(mark).toEqual({ src: brandIconDataUri(), width: 192, height: 192 });
  });

  it("serves a full-bleed maskable icon with the monogram in the safe zone", () => {
    getIconMaskable();

    const call = imageResponseMock.calls.at(-1);
    expect(iconMaskableDynamic).toBe("force-static");
    expect(call?.options).toEqual({ width: 512, height: 512 });
    expect(rootStyle(call!.element).backgroundColor).toBe(ICON_COPPER);

    const [mark] = findImages(call!.element);
    expect(mark).toEqual({
      src: brandIconDataUri({ withCircle: false }),
      width: 460,
      height: 460,
    });
    expect(decodeSvgDataUri(mark.src)).not.toContain("<circle");
  });

  it("keeps the committed icon.svg in sync with the brand icon source", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "src/app/icon.svg"),
      "utf8",
    );

    expect(svg.trim()).toBe(brandIconSvg());
    expect(svg).toContain(`viewBox="0 0 512 512"`);
    expect(svg).toContain(`fill="${ICON_COPPER}"`);
  });

  it("ships favicon.ico as a single 32px PNG-in-ICO", () => {
    const ico = readFileSync(resolve(process.cwd(), "src/app/favicon.ico"));

    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(1); // image count
    expect(ico[6]).toBe(32); // width
    expect(ico[7]).toBe(32); // height
    expect(ico.readUInt32LE(14)).toBe(ico.length - 22); // payload size
    expect(ico.readUInt32LE(18)).toBe(22); // payload offset
    expect([...ico.subarray(22, 30)]).toEqual([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
    ]);
  });

  it("renders the OpenGraph card with the brand headline", () => {
    OpenGraphImage();

    const call = imageResponseMock.calls.at(-1);
    expect(call?.options).toEqual(ogSize);
    expect(ogSize).toEqual({ width: 1200, height: 630 });
    expect(ogContentType).toBe("image/png");
    expect(ogAlt).toBe(`${BRAND_NAME} marketplace`);

    const text = textContent(call!.element);
    expect(text).toContain(BRAND_NAME.toUpperCase());
    expect(text).toContain("A fair market for generative art");
    expect(text).toContain("0% marketplace fees · Arbitrum");
  });
});
