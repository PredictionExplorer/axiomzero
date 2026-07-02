import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/wallet/connect-wallet-button", () => ({
  ConnectWalletButton: () => <button type="button">Connect wallet</button>,
}));

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("shows the three public destination links, mobile nav, and wallet action", () => {
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
});
