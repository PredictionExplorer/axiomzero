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
  offers,
}: {
  collection: Collection;
  tokenId: number;
  activeSellOffer?: MarketOffer;
  offers: MarketOffer[];
}) {
  return (
    <AppProviders>
      <TokenActionsInner
        collection={collection}
        tokenId={tokenId}
        activeSellOffer={activeSellOffer}
        offers={offers}
      />
    </AppProviders>
  );
}

function TokenActionsInner({
  collection,
  tokenId,
  activeSellOffer,
  offers,
}: {
  collection: Collection;
  tokenId: number;
  activeSellOffer?: MarketOffer;
  offers: MarketOffer[];
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
          error instanceof Error
            ? error.message
            : "Review your wallet and try again.",
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

  async function acceptSellOffer() {
    if (!publicClient || !address) {
      throw new Error("Connect your wallet to continue.");
    }

    if (!activeSellOffer?.offerId) {
      throw new Error("This listing is missing a live on-chain offer ID.");
    }

    const value = parseEther(String(activeSellOffer.priceEth));
    const prepared = await prepareContractWrite({
      publicClient,
      account: address,
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "acceptSellOffer",
      args: [BigInt(activeSellOffer.offerId)],
      value,
    });

    return writeContractAsync({
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName: "acceptSellOffer",
      args: [BigInt(activeSellOffer.offerId)],
      value,
      ...prepared,
    });
  }

  async function cancelOffer(offer: MarketOffer) {
    if (!publicClient || !address) {
      throw new Error("Connect your wallet to continue.");
    }

    if (!offer.offerId) {
      throw new Error("This order is missing a live on-chain offer ID.");
    }

    const functionName =
      offer.kind === "sell" ? "cancelSellOffer" : "cancelBuyOffer";
    const prepared = await prepareContractWrite({
      publicClient,
      account: address,
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName,
      args: [BigInt(offer.offerId)],
    });

    return writeContractAsync({
      address: collection.marketplaceAddress,
      abi: marketplaceAbi,
      functionName,
      args: [BigInt(offer.offerId)],
      ...prepared,
    });
  }

  const ownOffers = address
    ? offers.filter(
        (offer) =>
          offer.maker.toLowerCase() === address.toLowerCase() && offer.offerId,
      )
    : [];

  return (
    <section className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-copper">
          Market actions
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ivory">
          Market actions
        </h2>
        <p className="mt-3 text-sm leading-6 text-bone/78">
          Bid, list, or buy through the {collection.shortName} marketplace
          contract on Arbitrum. Review every wallet prompt before signing.
        </p>
      </div>

      {activeSellOffer ? (
        <div className="mt-5 rounded-2xl border border-chartreuse/20 bg-chartreuse/10 p-4">
          <p className="text-sm text-bone/78">Current listing</p>
          <p className="mt-1 text-2xl font-semibold text-chartreuse">
            {formatEth(activeSellOffer.priceEth)}
          </p>
          <Button
            className="mt-4 w-full"
            disabled={!isConnected || isPending || !activeSellOffer.offerId}
            onClick={() => void runTransaction(acceptSellOffer)}
          >
            Buy now for {formatEth(activeSellOffer.priceEth)}
          </Button>
          {!activeSellOffer.offerId ? (
            <p className="mt-2 text-xs text-bone/70">
              Buying is disabled because this listing did not include an offer
              ID.
            </p>
          ) : null}
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
          Bid
        </Button>
      </div>

      {ownOffers.length ? (
        <div className="mt-5 space-y-3 rounded-2xl border border-ivory/10 bg-ink/45 p-4">
          <p className="text-sm font-semibold text-ivory">Your active orders</p>
          {ownOffers.map((offer) => (
            <div
              key={offer.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-bone/78">
                {offer.kind === "sell" ? "Listing" : "Bid"} ·{" "}
                {formatEth(offer.priceEth)}
              </span>
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => void runTransaction(() => cancelOffer(offer))}
              >
                Cancel
              </Button>
            </div>
          ))}
        </div>
      ) : null}

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
