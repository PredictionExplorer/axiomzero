import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/wallet/connect-wallet-button", () => ({
  ConnectWalletButton: () => <button type="button">Connect wallet</button>,
}));

import { SiteHeader } from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("shows navigation and the wallet action without the redundant browse CTA", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: /marketplace/i })).toHaveAttribute(
      "href",
      "/marketplace",
    );
    expect(
      screen.getByRole("button", { name: /connect wallet/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /browse market/i }),
    ).not.toBeInTheDocument();
  });
});
