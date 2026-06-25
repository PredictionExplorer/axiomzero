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
  walletConfigurationWarning:
    "Wallet connections require NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.",
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: unknown) => React.ReactNode }) =>
      children({
        ...rainbowKitMock.state,
        authenticationStatus: "authenticated",
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

  it("renders a disabled fallback when WalletConnect is not configured", () => {
    walletConfigMock.isWalletConnectConfigured = false;

    render(<ConnectWalletButton />);

    expect(
      screen.getByRole("button", { name: /wallet unavailable/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/wallet connections require/i),
    ).toBeInTheDocument();
    expect(rainbowKitMock.openConnectModal).not.toHaveBeenCalled();
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
      chain: { name: "Arbitrum", unsupported: false },
    };

    render(<ConnectWalletButton />);

    expect(screen.getByRole("button", { name: /arbitrum/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /0x1234...abcd/i }),
    ).toBeInTheDocument();
  });
});
