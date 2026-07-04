import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans", className: "geist" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "geist-mono" }),
  Fraunces: () => ({ variable: "--font-fraunces", className: "fraunces" }),
}));

vi.mock("@/components/providers/app-providers", () => ({
  AppProviders: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-providers">{children}</div>
  ),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

vi.mock("@/components/layout/site-footer", () => ({
  SiteFooter: () => <footer data-testid="site-footer" />,
}));

import RootLayout, { metadata } from "@/app/layout";
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo/metadata";

describe("RootLayout", () => {
  it("declares brand metadata for every page", () => {
    expect(metadata.metadataBase).toEqual(new URL(SITE_URL));
    expect(metadata.title).toEqual({
      default: `${BRAND_NAME} | Generative NFT Marketplace`,
      template: `%s | ${BRAND_NAME}`,
    });
    expect(metadata.openGraph?.siteName).toBe(BRAND_NAME);
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("wraps pages in fonts, providers, chrome, and structured data", () => {
    const element = RootLayout({
      children: <div data-testid="page-content" />,
    }) as ReactElement<{
      lang: string;
      className: string;
      children: ReactElement;
    }>;

    expect(element.type).toBe("html");
    expect(element.props.lang).toBe("en");
    expect(element.props.className).toContain("--font-geist-sans");
    expect(element.props.className).toContain("--font-fraunces");

    const body = element.props.children;
    expect(body.type).toBe("body");

    // Render the body contents (html/body elements cannot nest in the test DOM).
    render(<div>{(body.props as { children: ReactNode }).children}</div>);

    expect(screen.getByTestId("app-providers")).toBeInTheDocument();
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();

    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    expect(jsonLd).not.toBeNull();
    const parsed = JSON.parse(jsonLd?.textContent ?? "[]") as Array<{
      "@type": string;
    }>;
    expect(parsed.map((item) => item["@type"])).toEqual([
      "Organization",
      "WebSite",
    ]);
  });
});
