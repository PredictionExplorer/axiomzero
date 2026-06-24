"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { cn } from "@/lib/utils";

export function ConnectWalletButton({ className }: { className?: string }) {
  return (
    <div className={cn("connect-wallet", className)}>
      <ConnectButton
        accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
        chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
        showBalance={{ smallScreen: false, largeScreen: true }}
      />
    </div>
  );
}
