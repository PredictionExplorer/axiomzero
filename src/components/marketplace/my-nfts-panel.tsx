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

import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { Button } from "@/components/ui/button";
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
            let ownedTokenIds: number[];

            try {
              ownedTokenIds = await readEnumerableTokenIds({
                client: publicClient,
                collection,
                owner: address,
              });
            } catch {
              let indexedTokenIds: number[] | undefined;

              try {
                indexedTokenIds = await readIndexedTokenIds({
                  client: publicClient,
                  collection,
                });
              } catch {
                indexedTokenIds = undefined;
              }

              ownedTokenIds = await scanOwnerOfRange({
                client: publicClient,
                collection,
                owner: address,
                tokenIds: indexedTokenIds,
                onProgress: setStatus,
              });
            }

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

      const approved = (await publicClient.readContract({
        address: item.collection.nftAddress,
        abi: erc721Abi,
        functionName: "isApprovedForAll",
        args: [address, item.collection.marketplaceAddress],
      })) as boolean;

      if (!approved) {
        const approvalPrepared = await prepareContractWrite({
          publicClient: walletPublicClient,
          account: address,
          address: item.collection.nftAddress,
          abi: erc721Abi,
          functionName: "setApprovalForAll",
          args: [item.collection.marketplaceAddress, true],
        });
        const approvalHash = await writeContractAsync({
          address: item.collection.nftAddress,
          abi: erc721Abi,
          functionName: "setApprovalForAll",
          args: [item.collection.marketplaceAddress, true],
          ...approvalPrepared,
        });
        toast.success("Approval submitted", { description: approvalHash });
        await publicClient.waitForTransactionReceipt?.({ hash: approvalHash });
        toast.success("Marketplace approval confirmed");
      }

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
            marketplace.
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

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-ink/48 p-4">
          <p className="text-sm text-bone/75">Owned NFTs</p>
          <p className="mt-1 text-2xl font-semibold text-ivory">
            {ownedItems.length}
          </p>
        </div>
        <div className="rounded-2xl bg-ink/48 p-4">
          <p className="text-sm text-bone/75">Bid alerts</p>
          <p className="mt-1 text-2xl font-semibold text-chartreuse">
            {alertCount}
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
          Open the token detail to review the full order book. This app can
          notify you while connected; persistent email or push alerts need a
          backend/indexer.
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {ownedItems.map((item) => {
          const key = tokenKey(item.token.collectionId, item.token.tokenId);

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
        <div className="mt-6 rounded-[2rem] border border-ivory/10 bg-ink/38 p-8 text-center">
          <h3 className="text-2xl font-semibold text-ivory">
            No owned NFTs found
          </h3>
          <p className="mt-3 text-bone/75">
            Try refreshing after switching wallets, or open a token directly if
            it sits outside the configured scan range.
          </p>
        </div>
      ) : null}
    </section>
  );
}
