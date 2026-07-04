import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GlobalError from "@/app/error";
import HomeLoading from "@/app/loading";
import NotFound from "@/app/not-found";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import RandomWalkLoading from "@/app/random-walk/loading";
import CosmicSignatureLoading from "@/app/cosmic-signature/loading";
import TokenLoading from "@/app/token/[collectionId]/[tokenId]/loading";
import { SiteFooter } from "@/components/layout/site-footer";
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/seo/metadata";

describe("SiteFooter", () => {
  it("links navigation, verified contracts, and brand principles", () => {
    render(<SiteFooter />);

    expect(screen.getByText(BRAND_NAME)).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "My NFTs" })).toHaveAttribute(
      "href",
      "/my-nfts",
    );
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );

    const externalLinks = screen.getAllByRole("link", {
      name: /visit .* site/i,
    });
    expect(externalLinks).toHaveLength(2);
    for (const link of externalLinks) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    }

    expect(
      screen.getAllByRole("link", { name: /^0x[0-9a-f]{6}\.\.\./i }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/0% marketplace fees/i)).toBeVisible();
  });
});

describe("GlobalError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the error and lets the user retry", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "digest-1" });

    render(<GlobalError error={error} reset={reset} />);

    expect(consoleError).toHaveBeenCalledWith(error);
    expect(
      screen.getByRole("heading", { name: /unexpected error/i }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("NotFound", () => {
  it("routes lost visitors back to the market", () => {
    render(<NotFound />);

    expect(screen.getByText("404")).toBeVisible();
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /random walk/i })).toHaveAttribute(
      "href",
      "/random-walk",
    );
    expect(
      screen.getByRole("link", { name: /cosmic signature/i }),
    ).toHaveAttribute("href", "/cosmic-signature");
  });
});

describe("loading screens", () => {
  it.each([
    ["home", HomeLoading],
    ["collection", RandomWalkLoading],
    ["cosmic signature", CosmicSignatureLoading],
    ["token", TokenLoading],
  ])("renders skeleton placeholders for the %s route", (_name, Loading) => {
    const { container } = render(<Loading />);

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });
});

describe("manifest", () => {
  it("describes the installable app with the brand icon", () => {
    const result = manifest();

    expect(result.name).toBe(BRAND_NAME);
    expect(result.short_name).toBe("Axiom Zero");
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
    expect(result.icons).toEqual([
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ]);
  });
});

describe("robots", () => {
  it("allows crawling everything and points at the sitemap", () => {
    const result = robots();

    expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
