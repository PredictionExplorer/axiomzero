"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConnectWalletButton({ className }: { className?: string }) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        authenticationStatus,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === "authenticated");

        if (!ready) {
          return (
            <div
              aria-hidden="true"
              className={cn(
                "connect-wallet h-11 min-w-[8.5rem] opacity-0",
                className,
              )}
            />
          );
        }

        return (
          <div
            className={cn(
              "connect-wallet flex items-center gap-2",
              className,
            )}
          >
            {!connected ? (
              <Button onClick={openConnectModal} type="button">
                Connect wallet
              </Button>
            ) : chain.unsupported ? (
              <Button onClick={openChainModal} type="button" variant="secondary">
                Wrong network
              </Button>
            ) : (
              <>
                <Button
                  onClick={openChainModal}
                  type="button"
                  variant="secondary"
                  className="hidden px-3 sm:inline-flex"
                  aria-label={`Connected to ${chain.name}`}
                >
                  {chain.hasIcon && chain.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      src={chain.iconUrl}
                      className="mr-2 size-4 rounded-full"
                    />
                  ) : null}
                  {chain.name}
                </Button>
                <Button onClick={openAccountModal} type="button">
                  {account.displayName}
                  {account.displayBalance ? (
                    <span className="ml-2 hidden text-ink/70 md:inline">
                      {account.displayBalance}
                    </span>
                  ) : null}
                </Button>
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
