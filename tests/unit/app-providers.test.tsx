import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const rainbowKitMocks = vi.hoisted(() => ({
  darkTheme: vi.fn(() => ({ mocked: "theme" })),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  RainbowKitProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="rainbowkit-provider">{children}</div>
  ),
  darkTheme: rainbowKitMocks.darkTheme,
}));

vi.mock("wagmi", () => ({
  WagmiProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="wagmi-provider">{children}</div>
  ),
}));

vi.mock("@/lib/web3/config", () => ({
  wagmiConfig: { mocked: "config" },
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

import { AppProviders } from "@/components/providers/app-providers";

describe("AppProviders", () => {
  it("nests wagmi, react-query, and RainbowKit around the app", () => {
    render(
      <AppProviders>
        <div data-testid="app-content" />
      </AppProviders>,
    );

    const wagmi = screen.getByTestId("wagmi-provider");
    const rainbowkit = screen.getByTestId("rainbowkit-provider");

    expect(wagmi).toContainElement(rainbowkit);
    expect(rainbowkit).toContainElement(screen.getByTestId("app-content"));
    expect(rainbowkit).toContainElement(screen.getByTestId("toaster"));
    expect(rainbowKitMocks.darkTheme).toHaveBeenCalledWith(
      expect.objectContaining({
        accentColor: "#d87932",
        borderRadius: "large",
      }),
    );
  });
});
