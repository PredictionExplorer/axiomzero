import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type RainbowKitState = {
  account?: {
    displayName: string;
    displayBalance?: string;
  };
  chain?: {
    hasIcon?: boolean;
    iconUrl?: string;
    name: string;
    unsupported?: boolean;
  };
  mounted: boolean;
  authenticationStatus?: "loading" | "unauthenticated" | "authenticated";
};

const rainbowKitMock = vi.hoisted(() => ({
  state: {
    mounted: true,
  } as RainbowKitState,
  openAccountModal: vi.fn(),
  openChainModal: vi.fn(),
  openConnectModal: vi.fn(),
}));
const walletConfigMock = vi.hoisted(() => ({
  isWalletConnectConfigured: true,
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: unknown) => React.ReactNode }) =>
      children({
        authenticationStatus: "authenticated",
        ...rainbowKitMock.state,
        openAccountModal: rainbowKitMock.openAccountModal,
        openChainModal: rainbowKitMock.openChainModal,
        openConnectModal: rainbowKitMock.openConnectModal,
      }),
  },
}));
vi.mock("@/lib/web3/config", () => walletConfigMock);

import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";

describe("ConnectWalletButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rainbowKitMock.state = { mounted: true };
    walletConfigMock.isWalletConnectConfigured = true;
  });

  it("still opens the connect modal when WalletConnect env is not configured", () => {
    walletConfigMock.isWalletConnectConfigured = false;

    render(<ConnectWalletButton />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

    expect(screen.queryByRole("button", { name: /wallet unavailable/i })).toBeNull();
    expect(rainbowKitMock.openConnectModal).toHaveBeenCalledTimes(1);
  });

  it("opens the connect modal when disconnected", () => {
    render(<ConnectWalletButton />);

    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

    expect(rainbowKitMock.openConnectModal).toHaveBeenCalledTimes(1);
  });

  it("opens the chain modal when the connected wallet is on an unsupported chain", () => {
    rainbowKitMock.state = {
      mounted: true,
      account: { displayName: "0x1234...abcd" },
      chain: { name: "Unsupported", unsupported: true },
    };

    render(<ConnectWalletButton />);

    fireEvent.click(screen.getByRole("button", { name: /wrong network/i }));

    expect(rainbowKitMock.openChainModal).toHaveBeenCalledTimes(1);
  });

  it("shows account and chain controls when connected", () => {
    rainbowKitMock.state = {
      mounted: true,
      account: {
        displayName: "0x1234...abcd",
        displayBalance: "1.23 ETH",
      },
      chain: {
        name: "Arbitrum",
        unsupported: false,
        hasIcon: true,
        iconUrl: "/arbitrum.svg",
      },
    };

    render(<ConnectWalletButton />);

    const chainButton = screen.getByRole("button", { name: /arbitrum/i });
    expect(chainButton).toBeInTheDocument();
    expect(chainButton.querySelector("img")).toHaveAttribute(
      "src",
      "/arbitrum.svg",
    );
    expect(
      screen.getByRole("button", { name: /0x1234...abcd/i }),
    ).toBeInTheDocument();
  });

  it("omits the chain icon and balance when the wallet does not provide them", () => {
    rainbowKitMock.state = {
      mounted: true,
      account: { displayName: "0x1234...abcd" },
      chain: { name: "Arbitrum", unsupported: false, hasIcon: true },
    };

    render(<ConnectWalletButton />);

    const chainButton = screen.getByRole("button", { name: /arbitrum/i });
    expect(chainButton.querySelector("img")).toBeNull();
    expect(screen.queryByText(/eth$/i)).toBeNull();
  });

  it("renders an invisible placeholder until RainbowKit has mounted", () => {
    rainbowKitMock.state = { mounted: false };

    const { container } = render(<ConnectWalletButton />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
      "opacity-0",
    );
  });

  it("renders the placeholder while authentication is loading", () => {
    rainbowKitMock.state = { mounted: true, authenticationStatus: "loading" };

    const { container } = render(<ConnectWalletButton />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
