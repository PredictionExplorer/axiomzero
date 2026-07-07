"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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

import { AnchorStatusPill } from "@/components/marketplace/anchor-status-pill";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { Button } from "@/components/ui/button";
import { TokenCardSkeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/tooltip";
import type {
  Collection,
  MarketOffer,
  MarketToken,
  TokenMarketSummary,
} from "@/lib/marketplace/types";
import {
  isPositiveEthAmount,
  sameAddress,
} from "@/lib/marketplace/trading-actions";
import { erc721Abi, marketplaceAbi } from "@/lib/web3/abis";
import { prepareContractWrite } from "@/lib/web3/transaction-preflight";
import { formatEth, formatTokenId } from "@/lib/utils";

const OWNER_SCAN_CHUNK_SIZE = 180;
const MAX_DETAIL_LOAD = 48;
const OWNED_TOKEN_API_PAGE_SIZE = 1_000;
const COSMIC_SIGNATURE_API_URL =
  process.env.NEXT_PUBLIC_COSMIC_SIGNATURE_API_URL ??
  "https://nfts.cosmicsignature.com";
const RANDOM_WALK_API_URL =
  process.env.NEXT_PUBLIC_RANDOM_WALK_API_URL ??
  "https://api.randomwalknft.com:1443";

type CollectionScanConfig = Pick<
  Collection,
  "id" | "shortName" | "nftAddress" | "marketplaceAddress" | "tokenRange"
>;

type TokenMarketResponse = {
  token: MarketToken;
  offers: MarketOffer[];
};

type OwnerScanItem = TokenMarketSummary & {
  collection: CollectionScanConfig;
};

type ContractReadClient = {
  readContract: (call: {
    address: `0x${string}`;
    abi: typeof erc721Abi;
    functionName: string;
    args?: readonly unknown[];
  }) => Promise<unknown>;
  multicall: (call: {
    allowFailure: true;
    contracts: Array<{
      address: `0x${string}`;
      abi: typeof erc721Abi;
      functionName: string;
      args?: readonly unknown[];
    }>;
  }) => Promise<
    Array<
      | { status: "success"; result: unknown }
      | { status: "failure"; error: unknown }
    >
  >;
};

function tokenKey(collectionId: string, tokenId: number) {
  return `${collectionId}:${tokenId}`;
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && value.startsWith("0x");
}

function fallbackTokenIds(collection: CollectionScanConfig) {
  return Array.from(
    {
      length: collection.tokenRange.end - collection.tokenRange.start + 1,
    },
    (_, index) => collection.tokenRange.start + index,
  );
}

function summarizeTokenMarket(
  market: TokenMarketResponse,
  collection: CollectionScanConfig,
): OwnerScanItem {
  const buyOffers = market.offers
    .filter((offer) => offer.kind === "buy")
    .sort((left, right) => right.priceEth - left.priceEth);
  const sellOffers = market.offers
    .filter((offer) => offer.kind === "sell")
    .sort((left, right) => left.priceEth - right.priceEth);

  return {
    collection,
    token: market.token,
    offers: market.offers,
    highestBid: buyOffers[0],
    activeSellOffer: sellOffers[0],
  };
}

async function loadTokenMarket(collectionId: string, tokenId: number) {
  const response = await fetch(
    `/api/marketplace/token/${collectionId}/${tokenId}`,
  );

  if (!response.ok) {
    throw new Error(`Token ${collectionId} ${tokenId} could not be loaded.`);
  }

  return (await response.json()) as TokenMarketResponse;
}

/**
 * Owned Cosmic Signature tokens straight from the collection's Go API (CORS
 * is open), which spares the wallet RPC a balanceOf + enumeration multicall.
 */
async function readCosmicSignatureOwnedTokenIds(owner: `0x${string}`) {
  const response = await fetch(
    `${COSMIC_SIGNATURE_API_URL}/api/cosmicgame/cst/list/by_user/${owner}/0/${OWNED_TOKEN_API_PAGE_SIZE}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    throw new Error(
      `Cosmic Signature owned-token lookup returned ${response.status}.`,
    );
  }

  const payload = (await response.json()) as {
    status?: number;
    UserTokens?: Array<{ TokenId?: unknown }> | null;
  };

  if (payload.status !== 1) {
    throw new Error("Cosmic Signature owned-token lookup failed.");
  }

  const tokenIds = (payload.UserTokens ?? [])
    .map((token) => token.TokenId)
    .filter(
      (tokenId): tokenId is number =>
        typeof tokenId === "number" && Number.isSafeInteger(tokenId),
    );

  return [...new Set(tokenIds)].sort((left, right) => left - right);
}

/**
 * Owned Random Walk tokens from the collection's Go API. The `tokens/by_user`
 * JSON handler accepts a raw 0x address, so this spares the wallet RPC a
 * balanceOf + enumeration multicall.
 */
async function readRandomWalkOwnedTokenIds(owner: `0x${string}`) {
  const response = await fetch(
    `${RANDOM_WALK_API_URL}/api/randomwalk/tokens/by_user/${owner}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    throw new Error(`Random Walk owned-token lookup returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
    status?: number;
    UserTokens?: Array<{ TokenId?: unknown }> | null;
  };

  if (payload.status !== 1) {
    throw new Error("Random Walk owned-token lookup failed.");
  }

  const tokenIds = (payload.UserTokens ?? [])
    .map((token) => token.TokenId)
    .filter(
      (tokenId): tokenId is number =>
        typeof tokenId === "number" && Number.isSafeInteger(tokenId),
    );

  return [...new Set(tokenIds)].sort((left, right) => left - right);
}

async function readEnumerableTokenIds({
  client,
  collection,
  owner,
}: {
  client: ContractReadClient;
  collection: CollectionScanConfig;
  owner: `0x${string}`;
}) {
  const balance = (await client.readContract({
    address: collection.nftAddress,
    abi: erc721Abi,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;
  const count = Math.min(Number(balance), MAX_DETAIL_LOAD);

  if (count === 0) {
    return [];
  }

  const results = await client.multicall({
    allowFailure: true,
    contracts: Array.from({ length: count }, (_, index) => ({
      address: collection.nftAddress,
      abi: erc721Abi,
      functionName: "tokenOfOwnerByIndex",
      args: [owner, BigInt(index)],
    })),
  });
  const tokenIds = results.flatMap((result) =>
    result.status === "success" && typeof result.result === "bigint"
      ? [Number(result.result)]
      : [],
  );

  if (!tokenIds.length && count > 0) {
    throw new Error("Enumerable owner tokens are unavailable.");
  }

  return tokenIds;
}

async function readIndexedTokenIds({
  client,
  collection,
}: {
  client: ContractReadClient;
  collection: CollectionScanConfig;
}) {
  const totalSupply = (await client.readContract({
    address: collection.nftAddress,
    abi: erc721Abi,
    functionName: "totalSupply",
  })) as bigint;
  const count = Number(totalSupply);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`${collection.shortName} totalSupply is invalid.`);
  }

  if (count === 0) {
    return [];
  }

  const results = await client.multicall({
    allowFailure: true,
    contracts: Array.from({ length: count }, (_, index) => ({
      address: collection.nftAddress,
      abi: erc721Abi,
      functionName: "tokenByIndex",
      args: [BigInt(index)],
    })),
  });
  const tokenIds = results.flatMap((result) =>
    result.status === "success" && typeof result.result === "bigint"
      ? [Number(result.result)]
      : [],
  );

  if (!tokenIds.length) {
    throw new Error(`${collection.shortName} token index is unavailable.`);
  }

  return [...new Set(tokenIds)].sort((left, right) => left - right);
}

async function scanOwnerOfRange({
  client,
  collection,
  owner,
  tokenIds,
  onProgress,
}: {
  client: ContractReadClient;
  collection: CollectionScanConfig;
  owner: `0x${string}`;
  tokenIds?: number[];
  onProgress: (message: string) => void;
}) {
  const candidateTokenIds = tokenIds ?? fallbackTokenIds(collection);
  const ownedTokenIds: number[] = [];

  for (
    let offset = 0;
    offset < candidateTokenIds.length;
    offset += OWNER_SCAN_CHUNK_SIZE
  ) {
    const chunk = candidateTokenIds.slice(
      offset,
      offset + OWNER_SCAN_CHUNK_SIZE,
    );
    onProgress(
      `Scanning ${collection.shortName} ${offset + 1}-${Math.min(
        offset + OWNER_SCAN_CHUNK_SIZE,
        candidateTokenIds.length,
      )} of ${candidateTokenIds.length}`,
    );
    const results = await client.multicall({
      allowFailure: true,
      contracts: chunk.map((tokenId) => ({
        address: collection.nftAddress,
        abi: erc721Abi,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      })),
    });

    results.forEach((result, index) => {
      if (
        result.status === "success" &&
        isAddress(result.result) &&
        sameAddress(result.result, owner)
      ) {
        ownedTokenIds.push(chunk[index]);
      }
    });
  }

  return ownedTokenIds.slice(0, MAX_DETAIL_LOAD);
}

/**
 * Owned token ids for one collection: collection API first where one exists,
 * then ERC-721 enumeration, then a chunked ownerOf range scan.
 */
async function resolveOwnedTokenIds({
  client,
  collection,
  owner,
  onProgress,
}: {
  client: ContractReadClient;
  collection: CollectionScanConfig;
  owner: `0x${string}`;
  onProgress: (message: string) => void;
}) {
  if (collection.id === "cosmic-signature") {
    try {
      return await readCosmicSignatureOwnedTokenIds(owner);
    } catch {
      // Fall through to on-chain reads when the collection API is down.
    }
  }

  if (collection.id === "random-walk") {
    try {
      return await readRandomWalkOwnedTokenIds(owner);
    } catch {
      // Fall through to on-chain reads when the collection API is down.
    }
  }

  try {
    return await readEnumerableTokenIds({ client, collection, owner });
  } catch {
    let indexedTokenIds: number[] | undefined;

    try {
      indexedTokenIds = await readIndexedTokenIds({ client, collection });
    } catch {
      indexedTokenIds = undefined;
    }

    return scanOwnerOfRange({
      client,
      collection,
      owner,
      tokenIds: indexedTokenIds,
      onProgress,
    });
  }
}

export function MyNftsPanel({
  collections,
}: {
  collections: CollectionScanConfig[];
}) {
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const walletPublicClient = usePublicClient();
  const publicClient = walletPublicClient as
    | (ContractReadClient & {
        waitForTransactionReceipt?: (args: {
          hash: `0x${string}`;
        }) => Promise<unknown>;
      })
    | undefined;
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [ownedItems, setOwnedItems] = useState<OwnerScanItem[]>([]);
  const [status, setStatus] = useState("Connect a wallet to scan your NFTs.");
  const [error, setError] = useState<string>();
  const [isScanning, setIsScanning] = useState(false);
  const [pendingKey, setPendingKey] = useState<string>();
  const [prices, setPrices] = useState<Record<string, string>>({});

  const isCorrectChain = chainId === arbitrum.id;
  const alertCount = useMemo(
    () => ownedItems.filter((item) => item.highestBid).length,
    [ownedItems],
  );
  const listedValueEth = useMemo(
    () =>
      ownedItems.reduce(
        (sum, item) => sum + (item.activeSellOffer?.priceEth ?? 0),
        0,
      ),
    [ownedItems],
  );

  const scanWallet = useCallback(async () => {
    if (!address || !publicClient) {
      setStatus("Connect a wallet to scan your NFTs.");
      return;
    }

    try {
      setIsScanning(true);
      setError(undefined);
      setOwnedItems([]);

      const collected = (
        await Promise.all(
          collections.map(async (collection) => {
            setStatus(`Reading ${collection.shortName} ownership.`);
            const ownedTokenIds = await resolveOwnedTokenIds({
              client: publicClient,
              collection,
              owner: address,
              onProgress: setStatus,
            });

            const uniqueTokenIds = [...new Set(ownedTokenIds)].slice(
              0,
              MAX_DETAIL_LOAD,
            );
            const markets = await Promise.all(
              uniqueTokenIds.map(async (tokenId) => {
                try {
                  return summarizeTokenMarket(
                    await loadTokenMarket(collection.id, tokenId),
                    collection,
                  );
                } catch {
                  return undefined;
                }
              }),
            );

            return markets.filter((item): item is OwnerScanItem =>
              Boolean(item),
            );
          }),
        )
      ).flat();

      collected.sort((left, right) => {
        if (left.highestBid && right.highestBid) {
          return right.highestBid.priceEth - left.highestBid.priceEth;
        }
        if (left.highestBid) {
          return -1;
        }
        if (right.highestBid) {
          return 1;
        }

        return left.token.tokenId - right.token.tokenId;
      });

      setOwnedItems(collected);
      setStatus(
        collected.length
          ? `Found ${collected.length} owned NFT${
              collected.length === 1 ? "" : "s"
            }.`
          : "No owned NFTs were found in the live collection supply.",
      );
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Your NFT inventory could not be scanned.",
      );
    } finally {
      setIsScanning(false);
    }
  }, [address, collections, publicClient]);

  useEffect(() => {
    if (isConnected) {
      const scanTimeout = window.setTimeout(() => void scanWallet(), 0);

      return () => window.clearTimeout(scanTimeout);
    }
  }, [isConnected, scanWallet]);

  async function ensureMarketplaceApproval(collection: CollectionScanConfig) {
    if (!address || !publicClient || !walletPublicClient) {
      throw new Error("Connect your wallet to continue.");
    }

    const approved = (await publicClient.readContract({
      address: collection.nftAddress,
      abi: erc721Abi,
      functionName: "isApprovedForAll",
      args: [address, collection.marketplaceAddress],
    })) as boolean;

    if (approved) {
      return;
    }

    const approvalPrepared = await prepareContractWrite({
      publicClient: walletPublicClient,
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
    await publicClient.waitForTransactionReceipt?.({ hash: approvalHash });
    toast.success("Marketplace approval confirmed");
  }

  async function listToken(item: OwnerScanItem) {
    const key = tokenKey(item.token.collectionId, item.token.tokenId);
    const price = prices[key];

    try {
      setPendingKey(key);
      if (!address || !publicClient || !walletPublicClient) {
        throw new Error("Connect your wallet to list this NFT.");
      }
      if (!isPositiveEthAmount(price)) {
        throw new Error("Enter a valid ETH price.");
      }
      if (!isCorrectChain) {
        await switchChainAsync({ chainId: arbitrum.id });
      }

      const owner = (await publicClient.readContract({
        address: item.collection.nftAddress,
        abi: erc721Abi,
        functionName: "ownerOf",
        args: [BigInt(item.token.tokenId)],
      })) as `0x${string}`;

      if (!sameAddress(owner, address)) {
        throw new Error("Only the current token owner can list this NFT.");
      }

      await ensureMarketplaceApproval(item.collection);

      const value = parseEther(price);
      const prepared = await prepareContractWrite({
        publicClient: walletPublicClient,
        account: address,
        address: item.collection.marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "makeSellOffer",
        args: [item.collection.nftAddress, BigInt(item.token.tokenId), value],
      });
      const hash = await writeContractAsync({
        address: item.collection.marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "makeSellOffer",
        args: [item.collection.nftAddress, BigInt(item.token.tokenId), value],
        ...prepared,
      });

      toast.success("Listing submitted", { description: hash });
      await publicClient.waitForTransactionReceipt?.({ hash });
      toast.success("Listing confirmed");
      router.refresh();
      await scanWallet();
    } catch (listError) {
      toast.error("Listing failed", {
        description:
          listError instanceof Error
            ? listError.message
            : "Review your wallet and try again.",
      });
    } finally {
      setPendingKey(undefined);
    }
  }

  async function acceptBid(item: OwnerScanItem) {
    const key = tokenKey(item.token.collectionId, item.token.tokenId);
    const bid = item.highestBid;

    try {
      setPendingKey(key);
      if (!address || !publicClient || !walletPublicClient) {
        throw new Error("Connect your wallet to accept this bid.");
      }
      if (!bid?.offerId) {
        throw new Error("This bid is missing a live on-chain offer ID.");
      }
      if (!isCorrectChain) {
        await switchChainAsync({ chainId: arbitrum.id });
      }

      await ensureMarketplaceApproval(item.collection);

      const prepared = await prepareContractWrite({
        publicClient: walletPublicClient,
        account: address,
        address: item.collection.marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "acceptBuyOffer",
        args: [BigInt(bid.offerId)],
      });
      const hash = await writeContractAsync({
        address: item.collection.marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "acceptBuyOffer",
        args: [BigInt(bid.offerId)],
        ...prepared,
      });

      toast.success("Bid acceptance submitted", { description: hash });
      await publicClient.waitForTransactionReceipt?.({ hash });
      toast.success("Bid accepted");
      router.refresh();
      await scanWallet();
    } catch (acceptError) {
      toast.error("Accepting the bid failed", {
        description:
          acceptError instanceof Error
            ? acceptError.message
            : "Review your wallet and try again.",
      });
    } finally {
      setPendingKey(undefined);
    }
  }

  async function cancelListing(item: OwnerScanItem) {
    const key = tokenKey(item.token.collectionId, item.token.tokenId);
    const listing = item.activeSellOffer;

    try {
      setPendingKey(key);
      if (!address || !publicClient || !walletPublicClient) {
        throw new Error("Connect your wallet to cancel this listing.");
      }
      if (!listing?.offerId) {
        throw new Error("This listing is missing a live on-chain offer ID.");
      }
      if (!isCorrectChain) {
        await switchChainAsync({ chainId: arbitrum.id });
      }

      const prepared = await prepareContractWrite({
        publicClient: walletPublicClient,
        account: address,
        address: item.collection.marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "cancelSellOffer",
        args: [BigInt(listing.offerId)],
      });
      const hash = await writeContractAsync({
        address: item.collection.marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "cancelSellOffer",
        args: [BigInt(listing.offerId)],
        ...prepared,
      });

      toast.success("Cancellation submitted", { description: hash });
      await publicClient.waitForTransactionReceipt?.({ hash });
      toast.success("Listing cancelled");
      router.refresh();
      await scanWallet();
    } catch (cancelError) {
      toast.error("Cancelling the listing failed", {
        description:
          cancelError instanceof Error
            ? cancelError.message
            : "Review your wallet and try again.",
      });
    } finally {
      setPendingKey(undefined);
    }
  }

  return (
    <section className="rounded-[2.5rem] border border-ivory/10 bg-ivory/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.22)]">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-copper">
            Connected inventory
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ivory">
            Your NFTs, listings, and bid alerts
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-bone/78">
            This in-app panel scans your connected wallet, highlights active
            bids on tokens you own, and lets you list without leaving the
            marketplace. Your first listing in each collection asks for a
            one-time marketplace approval so the verified contract can settle
            the sale.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 lg:justify-end">
          {!isConnected ? <ConnectWalletButton /> : null}
          {isConnected && !isCorrectChain ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void switchChainAsync({ chainId: arbitrum.id })}
            >
              Switch to Arbitrum
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={!isConnected || isScanning}
            onClick={() => void scanWallet()}
          >
            {isScanning ? "Scanning..." : "Refresh inventory"}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-ink/48 p-4">
          <p className="text-sm text-bone/75">Owned NFTs</p>
          <p className="font-display mt-1 text-2xl font-semibold text-ivory">
            {ownedItems.length}
          </p>
        </div>
        <div className="rounded-2xl bg-ink/48 p-4">
          <p className="flex items-center gap-1.5 text-sm text-bone/75">
            Bid alerts
            <InfoTip label="About bid alerts" align="start">
              Owned NFTs that currently have active bids from collectors. Open
              the token page to review the full order book.
            </InfoTip>
          </p>
          <p className="font-display mt-1 text-2xl font-semibold text-chartreuse">
            {alertCount}
          </p>
        </div>
        <div className="rounded-2xl bg-ink/48 p-4">
          <p className="flex items-center gap-1.5 text-sm text-bone/75">
            Listed value
            <InfoTip label="About listed value" align="start">
              The combined ETH price of your active sale listings across both
              collections.
            </InfoTip>
          </p>
          <p className="font-display mt-1 text-2xl font-semibold text-ivory">
            {listedValueEth > 0 ? formatEth(listedValueEth) : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-ink/48 p-4">
          <p className="text-sm text-bone/75">Status</p>
          <p className="mt-1 text-sm font-medium text-ivory">{status}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-ember/30 bg-ember/10 p-4 text-sm text-bone">
          {error}
        </div>
      ) : null}

      {alertCount ? (
        <div className="mt-5 rounded-2xl border border-chartreuse/25 bg-chartreuse/10 p-4 text-sm leading-6 text-bone">
          <span className="font-semibold text-chartreuse">
            {alertCount} owned NFT{alertCount === 1 ? " has" : "s have"} active
            bids.
          </span>{" "}
          Accept a bid directly from its card below — the ETH settles into
          your wallet in the same transaction — or open the token detail to
          review the full order book.
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isScanning
          ? Array.from({ length: 3 }, (_, index) => (
              <TokenCardSkeleton key={`skeleton-${index}`} />
            ))
          : ownedItems.map((item) => {
          const key = tokenKey(item.token.collectionId, item.token.tokenId);
          const acceptableBid =
            item.highestBid?.offerId &&
            !sameAddress(item.highestBid.maker, address)
              ? item.highestBid
              : undefined;
          const ownListing =
            item.activeSellOffer?.offerId &&
            sameAddress(item.activeSellOffer.maker, address)
              ? item.activeSellOffer
              : undefined;

          return (
            <article
              key={key}
              className="overflow-hidden rounded-[2rem] border border-ivory/10 bg-ink/38"
            >
              <a
                href={`/token/${item.token.collectionId}/${item.token.tokenId}`}
                className="relative block aspect-square bg-carbon"
              >
                <Image
                  src={item.token.artwork.image}
                  alt={item.token.artwork.alt}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                  className="object-contain p-4"
                />
                {item.highestBid ? (
                  <span className="absolute left-4 top-4 rounded-full border border-chartreuse/25 bg-chartreuse/12 px-3 py-1 text-xs font-semibold text-chartreuse backdrop-blur">
                    Bid alert
                  </span>
                ) : null}
                <AnchorStatusPill
                  anchored={item.token.anchored}
                  className="absolute right-4 top-4"
                />
              </a>

              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-copper">
                    {item.collection.shortName}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-ivory">
                    {formatTokenId(item.token.tokenId)}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-ivory/[0.045] p-3">
                    <p className="text-bone/75">Listing</p>
                    <p className="mt-1 font-semibold text-ivory">
                      {item.activeSellOffer
                        ? formatEth(item.activeSellOffer.priceEth)
                        : "Unlisted"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-ivory/[0.045] p-3">
                    <p className="text-bone/75">Highest bid</p>
                    <p className="mt-1 font-semibold text-chartreuse">
                      {item.highestBid
                        ? formatEth(item.highestBid.priceEth)
                        : "None"}
                    </p>
                  </div>
                </div>

                {acceptableBid || ownListing ? (
                  <div className="grid gap-3">
                    {acceptableBid ? (
                      <Button
                        type="button"
                        disabled={
                          pendingKey === key || !isConnected || !isCorrectChain
                        }
                        onClick={() => void acceptBid(item)}
                      >
                        Accept bid · {formatEth(acceptableBid.priceEth)}
                      </Button>
                    ) : null}
                    {ownListing ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          pendingKey === key || !isConnected || !isCorrectChain
                        }
                        onClick={() => void cancelListing(item)}
                      >
                        Cancel listing · {formatEth(ownListing.priceEth)}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-bone/75">
                    List price
                  </span>
                  <input
                    value={prices[key] ?? ""}
                    onChange={(event) =>
                      setPrices((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder="0.5000"
                    inputMode="decimal"
                    className="h-11 w-full rounded-2xl border border-ivory/10 bg-carbon px-4 text-sm text-ivory outline-none transition placeholder:text-bone/35 focus:border-chartreuse"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    disabled={
                      pendingKey === key ||
                      !isConnected ||
                      !isCorrectChain ||
                      !isPositiveEthAmount(prices[key] ?? "")
                    }
                    onClick={() => void listToken(item)}
                  >
                    List NFT
                  </Button>
                  <a
                    href={`/token/${item.token.collectionId}/${item.token.tokenId}`}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] px-5 text-sm font-semibold text-ivory transition hover:bg-ivory/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse"
                  >
                    View details
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {isConnected && !isScanning && !ownedItems.length ? (
        <div className="relative mt-6 overflow-hidden rounded-[2rem] border border-ivory/10 bg-ink/38 p-10 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
          >
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-copper/30" />
            <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full border border-chartreuse/20" />
          </div>
          <div className="relative">
            <h3 className="font-display text-2xl font-semibold text-ivory">
              No owned NFTs found
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-bone/75">
              Try refreshing after switching wallets, or open a token directly
              if it sits outside the configured scan range. Browse the
              collections to start building your gallery.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="/random-walk"
                className="inline-flex h-11 items-center justify-center rounded-full bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember"
              >
                Browse Random Walk
              </a>
              <a
                href="/cosmic-signature"
                className="inline-flex h-11 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] px-5 text-sm font-semibold text-ivory transition hover:bg-ivory/[0.09]"
              >
                Browse Cosmic Signature
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
