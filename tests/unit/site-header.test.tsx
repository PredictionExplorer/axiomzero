import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/wallet/connect-wallet-button", () => ({
  ConnectWalletButton: () => <button type="button">Connect wallet</button>,
}));

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("shows the four public destination links, mobile nav, and wallet action", () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole("navigation", { name: /primary/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /my nfts/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /random walk/i })[0]).toHaveAttribute(
      "href",
      "/random-walk",
    );
    expect(screen.getAllByRole("link", { name: /cosmic signature/i })[0]).toHaveAttribute(
      "href",
      "/cosmic-signature",
    );
    expect(screen.getAllByRole("link", { name: /^faq$/i })[0]).toHaveAttribute(
      "href",
      "/faq",
    );
    expect(
      screen.getByRole("button", { name: /open navigation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect wallet/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /marketplace/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /browse market/i }),
    ).not.toBeInTheDocument();
  });

  it("toggles the mobile menu and locks body scroll while it is open", () => {
    const { unmount } = render(<SiteHeader />);

    const toggle = screen.getByRole("button", { name: /open navigation/i });
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", { name: /close navigation/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: /close navigation/i }));

    expect(
      screen.getByRole("button", { name: /open navigation/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");

    unmount();
  });

  it("closes the mobile menu when a navigation link is chosen", () => {
    render(<SiteHeader />);

    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));

    const mobileNav = document.getElementById("mobile-nav");
    const mobileFaqLink = mobileNav?.querySelector('a[href="/faq"]');
    expect(mobileFaqLink).not.toBeNull();

    fireEvent.click(mobileFaqLink!);

    expect(
      screen.getByRole("button", { name: /open navigation/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });
});
