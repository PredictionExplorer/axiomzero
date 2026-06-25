"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, arbitrumSepolia } from "wagmi/chains";

const WALLETCONNECT_PLACEHOLDER = "00000000000000000000000000000000";
const isVercelProduction = process.env.VERCEL_ENV === "production";
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  (isVercelProduction ? undefined : WALLETCONNECT_PLACEHOLDER);

if (!walletConnectProjectId) {
  throw new Error(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required for production wallet connections.",
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "Axiom Zero",
  projectId: walletConnectProjectId,
  chains: [arbitrum, arbitrumSepolia],
  ssr: true,
});
