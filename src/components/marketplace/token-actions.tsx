"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { arbitrum } from "wagmi/chains";
import { toast } from "sonner";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import type { Collection, MarketOffer } from "@/lib/marketplace/types";
import { Button } from "@/components/ui/button";
import { erc721Abi, marketplaceAbi } from "@/lib/web3/abis";
import { prepareContractWrite } from "@/lib/web3/transaction-preflight";
import { formatEth } from "@/lib/utils";
import {
  isPositiveEthAmount,
  sameAddress,
} from "@/lib/marketplace/trading-actions";

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
    <TokenActionsInner
      collection={collection}
      tokenId={tokenId}
      activeSellOffer={activeSellOffer}
      offers={offers}
    />
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
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [price, setPrice] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [tokenOwner, setTokenOwner] = useState<`0x${string}`>();
  const [isApprovedForMarketplace, setIsApprovedForMarketplace] =
    useState(false);
  const [tokenStateError, setTokenStateError] = useState<string>();

  const isCorrectChain = chainId === arbitrum.id;
  const isOwner = sameAddress(address, tokenOwner);

  const refreshTokenState = useCallback(async () => {
    if (!publicClient) {
      return;
    }

    try {
      const owner = (await publicClient.readContract({
        address: collection.nftAddress,
        abi: erc721Abi,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      })) as `0x${string}`;
      const approved = address
        ? ((await publicClient.readContract({
            address: collection.nftAddress,
            abi: erc721Abi,
            functionName: "isApprovedForAll",
            args: [address, collection.marketplaceAddress],
          })) as boolean)
        : false;

      setTokenOwner(owner);
      setIsApprovedForMarketplace(approved);
      setTokenStateError(undefined);
    } catch (error) {
      setTokenStateError(
        error instanceof Error
          ? error.message
          : "Token ownership could not be loaded.",
      );
    }
  }, [
    address,
    collection.marketplaceAddress,
    collection.nftAddress,
    publicClient,
    tokenId,
  ]);

  useEffect(() => {
    let isCurrent = true;

    async function loadTokenState() {
      if (!publicClient) {
        return;
      }

      try {
        const owner = (await publicClient.readContract({
          address: collection.nftAddress,
          abi: erc721Abi,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        })) as `0x${string}`;
        const approved = address
          ? ((await publicClient.readContract({
              address: collection.nftAddress,
              abi: erc721Abi,
              functionName: "isApprovedForAll",
              args: [address, collection.marketplaceAddress],
            })) as boolean)
          : false;

        if (!isCurrent) {
          return;
        }

        setTokenOwner(owner);
        setIsApprovedForMarketplace(approved);
        setTokenStateError(undefined);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setTokenStateError(
          error instanceof Error
            ? error.message
            : "Token ownership could not be loaded.",
        );
      }
    }

    void loadTokenState();

    return () => {
      isCurrent = false;
    };
  }, [
    address,
    collection.marketplaceAddress,
    collection.nftAddress,
    publicClient,
    tokenId,
  ]);

  const ownOffers = useMemo(
    () =>
      address
        ? offers.filter(
            (offer) => sameAddress(offer.maker, address) && offer.offerId,
          )
        : [],
    [address, offers],
  );

  const walletBlocker = !isConnected
    ? "Connect a wallet to activate trading controls."
    : !isCorrectChain
      ? "Switch to Arbitrum to trade through the marketplace contract."
      : undefined;
  const amountBlocker = isPositiveEthAmount(price)
    ? undefined
    : "Enter a valid ETH amount.";
  const listingBlocker =
    walletBlocker ??
    amountBlocker ??
    (!isOwner ? "Only the current owner can list this NFT." : undefined);
  const bidBlocker =
    walletBlocker ??
    amountBlocker ??
    (isOwner ? "Owners cannot bid on their own NFT." : undefined);
  const buyBlocker =
    walletBlocker ??
    (activeSellOffer && sameAddress(activeSellOffer.maker, address)
      ? "You cannot buy your own listing."
      : undefined);

  async function runTransaction(action: () => Promise<`0x${string}`>) {
    try {
      setIsPending(true);
      if (!isConnected) {
        throw new Error("Connect your wallet to continue.");
      }
      if (!isCorrectChain) {
        await switchChainAsync({ chainId: arbitrum.id });
      }
      const hash = await action();
      toast.success("Transaction submitted", { description: hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success("Transaction confirmed");
      await refreshTokenState();
      router.refresh();
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

    if (!isPositiveEthAmount(price)) {
      throw new Error("Enter a valid ETH price.");
    }

    if (!isOwner) {
      throw new Error("Only the current token owner can list this NFT.");
    }

    if (!isApprovedForMarketplace) {
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
      toast.success("Approval submitted", { description: approvalHash });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      toast.success("Marketplace approval confirmed");
    }

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

    if (!isPositiveEthAmount(price)) {
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

      {walletBlocker || tokenStateError ? (
        <div className="mt-5 rounded-2xl border border-copper/20 bg-copper/10 p-4 text-sm leading-6 text-bone/82">
          <p>{walletBlocker ?? tokenStateError}</p>
          {isConnected && !isCorrectChain ? (
            <Button
              className="mt-3"
              onClick={() => void switchChainAsync({ chainId: arbitrum.id })}
              type="button"
              variant="secondary"
            >
              Switch to Arbitrum
            </Button>
          ) : null}
        </div>
      ) : null}

      {isConnected && isCorrectChain && tokenOwner ? (
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Ownership</p>
            <p className="mt-1 font-semibold text-ivory">
              {isOwner ? "Connected wallet owns this token" : "View-only wallet"}
            </p>
          </div>
          <div className="rounded-2xl bg-ink/48 p-3">
            <p className="text-bone/75">Marketplace approval</p>
            <p className="mt-1 font-semibold text-ivory">
              {isApprovedForMarketplace ? "Approved" : "Approval required"}
            </p>
          </div>
        </div>
      ) : null}

      {activeSellOffer ? (
        <div className="mt-5 rounded-2xl border border-chartreuse/20 bg-chartreuse/10 p-4">
          <p className="text-sm text-bone/78">Current listing</p>
          <p className="mt-1 text-2xl font-semibold text-chartreuse">
            {formatEth(activeSellOffer.priceEth)}
          </p>
          <Button
            className="mt-4 w-full"
            disabled={Boolean(buyBlocker) || isPending || !activeSellOffer.offerId}
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
          {buyBlocker ? (
            <p className="mt-2 text-xs text-bone/70">{buyBlocker}</p>
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
          disabled={Boolean(listingBlocker) || isPending}
          onClick={() => void runTransaction(createSellOffer)}
        >
          {isApprovedForMarketplace ? "List token" : "Approve and list"}
        </Button>
        <Button
          variant="secondary"
          disabled={Boolean(bidBlocker) || isPending}
          onClick={() => void runTransaction(createBuyOffer)}
        >
          Bid
        </Button>
      </div>

      {listingBlocker || bidBlocker ? (
        <p className="mt-3 text-sm text-bone/75">
          {listingBlocker ?? bidBlocker}
        </p>
      ) : null}

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
                disabled={Boolean(walletBlocker) || isPending}
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
