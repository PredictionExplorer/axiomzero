"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { AppProviders } from "@/components/providers/app-providers";
import type { Collection, MarketOffer } from "@/lib/marketplace/types";
import { Button } from "@/components/ui/button";
import { erc721Abi, marketplaceAbi } from "@/lib/web3/abis";
import { prepareContractWrite } from "@/lib/web3/transaction-preflight";
import { formatEth } from "@/lib/utils";

export function TokenActions({
  collection,
  tokenId,
  activeSellOffer,
}: {
  collection: Collection;
  tokenId: number;
  activeSellOffer?: MarketOffer;
}) {
  return (
    <AppProviders>
      <TokenActionsInner
        collection={collection}
        tokenId={tokenId}
        activeSellOffer={activeSellOffer}
      />
    </AppProviders>
  );
}

function TokenActionsInner({
  collection,
  tokenId,
  activeSellOffer,
}: {
  collection: Collection;
  tokenId: number;
  activeSellOffer?: MarketOffer;
}) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [price, setPrice] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function runTransaction(action: () => Promise<`0x${string}`>) {
    try {
      setIsPending(true);
      const hash = await action();
      toast.success("Transaction submitted", { description: hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success("Transaction confirmed");
    } catch (error) {
      toast.error("Transaction failed", {
        description:
          error instanceof Error ? error.message : "Review your wallet and try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function createSellOffer() {
    if (!publicClient || !address) {
      throw new Error("Connect your wallet to continue.");
    }

    if (!price || Number(price) <= 0) {
      throw new Error("Enter a valid ETH price.");
    }

    const approvalPrepared = await prepareContractWrite({
      publicClient,
      account: address,
      address: collection.nftAddress,
      abi: erc721Abi,
      functionName: "setApprovalForAll",
      args: [collection.marketplaceAddress, true],
    });
    const approvalHash = await writeContractAsync({
      address: collection.nftAddress,
      abi: erc721Abi,
      functionName: "setApprovalForAll",
      args: [collection.marketplaceAddress, true],
      ...approvalPrepared,
    });
    await publicClient.waitForTransactionReceipt({ hash: approvalHash });

    const prepared = await prepareContractWrite({
      publicClient,
      account: address,
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "makeSellOffer",
      args: [collection.nftAddress, BigInt(tokenId), parseEther(price)],
    });

    return writeContractAsync({
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "makeSellOffer",
      args: [collection.nftAddress, BigInt(tokenId), parseEther(price)],
      ...prepared,
    });
  }

  async function createBuyOffer() {
    if (!publicClient || !address) {
      throw new Error("Connect your wallet to continue.");
    }

    if (!price || Number(price) <= 0) {
      throw new Error("Enter a valid ETH price.");
    }

    const value = parseEther(price);
    const prepared = await prepareContractWrite({
      publicClient,
      account: address,
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "makeBuyOffer",
      args: [collection.nftAddress, BigInt(tokenId)],
      value,
    });

    return writeContractAsync({
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "makeBuyOffer",
      args: [collection.nftAddress, BigInt(tokenId)],
      value,
      ...prepared,
    });
  }

  return (
    <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-copper">
          Market actions
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ivory">
          Trade without privileged lanes
        </h2>
        <p className="mt-3 text-sm leading-6 text-bone/78">
          Listings and offers use the collection marketplace contract on
          Arbitrum. Review every wallet prompt before signing.
        </p>
      </div>

      {activeSellOffer ? (
        <div className="mt-5 rounded-2xl border border-chartreuse/20 bg-chartreuse/10 p-4">
          <p className="text-sm text-bone/78">Current listing</p>
          <p className="mt-1 text-2xl font-semibold text-chartreuse">
            {formatEth(activeSellOffer.priceEth)}
          </p>
        </div>
      ) : null}

      <label className="mt-5 block space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-bone/75">
          ETH amount
        </span>
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="0.5000"
          inputMode="decimal"
          className="h-12 w-full rounded-2xl border border-ivory/10 bg-ink px-4 text-sm text-ivory outline-none transition placeholder:text-bone/35 focus:border-chartreuse"
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button
          disabled={!isConnected || isPending}
          onClick={() => void runTransaction(createSellOffer)}
        >
          List token
        </Button>
        <Button
          variant="secondary"
          disabled={!isConnected || isPending}
          onClick={() => void runTransaction(createBuyOffer)}
        >
          Make offer
        </Button>
      </div>

      {!isConnected ? (
        <div className="mt-4 space-y-3">
          <ConnectWalletButton />
          <p className="text-sm text-bone/75">
            Connect a wallet to activate trading controls.
          </p>
        </div>
      ) : null}
    </section>
  );
}
