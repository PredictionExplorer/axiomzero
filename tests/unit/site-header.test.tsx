import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/wallet/connect-wallet-button", () => ({
  ConnectWalletButton: () => <button type="button">Connect wallet</button>,
}));

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("shows the three public destination links and the wallet action", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: /my nfts/i })).toHaveAttribute(
      "href",
      "/my-nfts",
    );
    expect(screen.getByRole("link", { name: /random walk/i })).toHaveAttribute(
      "href",
      "/random-walk",
    );
    expect(
      screen.getByRole("link", { name: /cosmic signature/i }),
    ).toHaveAttribute("href", "/cosmic-signature");
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
