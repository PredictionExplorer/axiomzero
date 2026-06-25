"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, arbitrumSepolia } from "wagmi/chains";

const WALLETCONNECT_PLACEHOLDER = "00000000000000000000000000000000";
export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || undefined;
export const isWalletConnectConfigured = Boolean(walletConnectProjectId);
export const walletConfigurationWarning =
  "Wallet connections require NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Browsing stays available, but wallet actions are disabled until it is configured.";

const wagmiProjectId = walletConnectProjectId ?? WALLETCONNECT_PLACEHOLDER;

export const wagmiConfig = getDefaultConfig({
  appName: "Axiom Zero",
  projectId: wagmiProjectId,
  chains: [arbitrum, arbitrumSepolia],
  ssr: true,
});
