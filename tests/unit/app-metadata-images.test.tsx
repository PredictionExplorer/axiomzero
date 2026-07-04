import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

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
import OpenGraphImage, {
  alt as ogAlt,
  size as ogSize,
  contentType as ogContentType,
} from "@/app/opengraph-image";
import { BRAND_NAME } from "@/lib/brand";

function textContent(element: ReactElement): string {
  const { children } = element.props as {
    children?: ReactElement | ReactElement[] | string;
  };

  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children)) {
    return children
      .map((child) =>
        typeof child === "string" ? child : textContent(child),
      )
      .join(" ");
  }
  if (children) {
    return textContent(children);
  }
  return "";
}

describe("app metadata images", () => {
  it("renders the favicon as a 512px copper monogram", () => {
    Icon();

    const call = imageResponseMock.calls.at(-1);
    expect(call?.options).toEqual(iconSize);
    expect(iconSize).toEqual({ width: 512, height: 512 });
    expect(iconContentType).toBe("image/png");
    expect(textContent(call!.element)).toContain("AZ");
  });

  it("renders the apple touch icon at 180px", () => {
    AppleIcon();

    const call = imageResponseMock.calls.at(-1);
    expect(call?.options).toEqual(appleIconSize);
    expect(appleIconSize).toEqual({ width: 180, height: 180 });
    expect(appleIconContentType).toBe("image/png");
    expect(textContent(call!.element)).toContain("AZ");
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
