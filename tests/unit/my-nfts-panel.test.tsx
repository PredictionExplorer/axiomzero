import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Collection } from "@/lib/marketplace/types";

const wagmiMock = vi.hoisted(() => ({
  account: {
    address: undefined as `0x${string}` | undefined,
    chainId: undefined as number | undefined,
    isConnected: false,
  },
  switchChainAsync: vi.fn(),
  writeContractAsync: vi.fn(),
  publicClient: undefined as
    | {
        readContract: ReturnType<typeof vi.fn>;
        multicall: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => wagmiMock.account,
  usePublicClient: () => wagmiMock.publicClient,
  useSwitchChain: () => ({ switchChainAsync: wagmiMock.switchChainAsync }),
  useWriteContract: () => ({ writeContractAsync: wagmiMock.writeContractAsync }),
}));

vi.mock("@/components/wallet/connect-wallet-button", () => ({
  ConnectWalletButton: () => <button type="button">Connect wallet</button>,
}));

vi.mock("@/lib/web3/transaction-preflight", () => ({
  prepareContractWrite: vi.fn(async () => ({ gas: 100_000n })),
}));

import { MyNftsPanel } from "@/components/marketplace/my-nfts-panel";

const collection = {
  id: "random-walk",
  name: "Random Walk NFTs",
  shortName: "Random Walk",
  description: "",
  artSystem: "",
  nftAddress: "0x895a6F444BE4ba9d124F61DF736605792B35D66b",
  marketplaceAddress: "0x47eF85Dfb775aCE0934fBa9EEd09D22e6eC0Cc08",
  anchoringWalletAddress: "0x5EB3396092841E6c5b0b51141699F6711E830529",
  externalUrl: "https://randomwalknft.com/",
  accent: "copper",
  supplyNoun: {
    singular: "walk",
    plural: "walks",
  },
  tokenRange: { start: 0, end: 2 },
} satisfies Collection;

const cosmicCollection = {
  ...collection,
  id: "cosmic-signature",
  name: "Cosmic Signature NFTs",
  shortName: "Cosmic Signature",
  nftAddress: "0xbb84Be3500A63581d3F2d5AC3bdF8685AAedad25",
  anchoringWalletAddress: "0x6308A405B4FF1eA890870Efe2a6D036750B81F7C",
  externalUrl: "https://cosmicsignature.com/",
  supplyNoun: { singular: "signature", plural: "signatures" },
} satisfies Collection;

function marketResponse(collectionId: string, tokenId: number) {
  return new Response(
    JSON.stringify({
      token: {
        collectionId,
        tokenId,
        name: `Token #${tokenId}`,
        owner: "0x0000000000000000000000000000000000000001",
        seed: "seed",
        traits: [],
        artwork: { image: "/art.png", alt: "Token artwork" },
      },
      offers: [],
    }),
  );
}

describe("MyNftsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wagmiMock.account = {
      address: undefined,
      chainId: undefined,
      isConnected: false,
    };
    wagmiMock.publicClient = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts disconnected users to connect before scanning", () => {
    render(<MyNftsPanel collections={[collection]} />);

    expect(
      screen.getByRole("heading", { name: /your nfts, listings, and bid alerts/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeVisible();
    expect(screen.getByText(/connect a wallet to scan your nfts/i)).toBeVisible();
  });

  it("asks connected users on the wrong chain to switch to Arbitrum", () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      isConnected: true,
    };

    render(<MyNftsPanel collections={[collection]} />);

    expect(
      screen.getByRole("button", { name: /switch to arbitrum/i }),
    ).toBeVisible();
  });

  it("loads owned NFTs through ERC721 enumerable reads and shows bid alerts", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async () => 1n),
      multicall: vi.fn(async () => [{ status: "success", result: 7n }]),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            token: {
              collectionId: "random-walk",
              tokenId: 7,
              name: "Random Walk #000007",
              owner: "0x0000000000000000000000000000000000000001",
              seed: "seed",
              traits: [],
              artwork: {
                image:
                  "https://api.randomwalknft.com:1443/images/randomwalk/000007_black_thumb.jpg",
                alt: "Token artwork",
              },
            },
            offers: [
              {
                id: "bid",
                collectionId: "random-walk",
                tokenId: 7,
                kind: "buy",
                priceEth: 0.5,
                maker: "0x0000000000000000000000000000000000000002",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        ),
      ),
    );

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/bid alert/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/0.5000 eth/i)).toBeInTheDocument();
  });

  it("accepts bids and cancels own listings straight from owned cards", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
        functionName === "balanceOf"
          ? 1n
          : functionName === "isApprovedForAll"
            ? true
            : functionName === "ownerOf"
              ? "0x0000000000000000000000000000000000000001"
              : 0n,
      ),
      multicall: vi.fn(async () => [{ status: "success", result: 7n }]),
    };
    wagmiMock.writeContractAsync.mockResolvedValue("0xhash");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            token: {
              collectionId: "random-walk",
              tokenId: 7,
              name: "Random Walk #000007",
              owner: "0x0000000000000000000000000000000000000001",
              seed: "seed",
              traits: [],
              anchored: false,
              artwork: {
                image:
                  "https://api.randomwalknft.com:1443/images/randomwalk/000007_black_thumb.jpg",
                alt: "Token artwork",
              },
            },
            offers: [
              {
                id: "bid",
                offerId: 12,
                collectionId: "random-walk",
                tokenId: 7,
                kind: "buy",
                priceEth: 0.5,
                maker: "0x0000000000000000000000000000000000000002",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "listing",
                offerId: 34,
                collectionId: "random-walk",
                tokenId: 7,
                kind: "sell",
                priceEth: 1,
                maker: "0x0000000000000000000000000000000000000001",
                createdAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          }),
        ),
      ),
    );

    render(<MyNftsPanel collections={[collection]} />);

    const acceptButton = await screen.findByRole("button", {
      name: /accept bid · 0\.5000 eth/i,
    });
    const cancelButton = screen.getByRole("button", {
      name: /cancel listing · 1\.00 eth/i,
    });

    expect(screen.getByText(/never anchored/i)).toBeInTheDocument();

    fireEvent.click(acceptButton);
    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "acceptBuyOffer",
          args: [12n],
        }),
      );
    });

    fireEvent.click(cancelButton);
    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "cancelSellOffer",
          args: [34n],
        }),
      );
    });
  });

  it("reads Cosmic Signature ownership from the collection API without chain scans", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async () => {
        throw new Error("chain reads should not run when the API responds");
      }),
      multicall: vi.fn(async () => []),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes("/api/cosmicgame/cst/list/by_user/")) {
          expect(url).toBe(
            "https://nfts.cosmicsignature.com/api/cosmicgame/cst/list/by_user/0x0000000000000000000000000000000000000001/0/1000",
          );
          return new Response(
            JSON.stringify({
              UserTokens: [{ TokenId: 13 }],
              error: "",
              status: 1,
            }),
          );
        }

        return marketResponse("cosmic-signature", 13);
      }),
    );

    render(<MyNftsPanel collections={[cosmicCollection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /#000013/i })).toBeVisible();
    expect(wagmiMock.publicClient?.readContract).not.toHaveBeenCalled();
  });

  it("falls back to chain scans when the Cosmic Signature API is down", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async () => 1n),
      multicall: vi.fn(async () => [{ status: "success", result: 13n }]),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes("/api/cosmicgame/cst/list/by_user/")) {
          return new Response("", { status: 503 });
        }

        return marketResponse("cosmic-signature", 13);
      }),
    );

    render(<MyNftsPanel collections={[cosmicCollection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(wagmiMock.publicClient?.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "balanceOf" }),
    );
  });

  it("falls back to ownerOf range scans when enumerable reads are unavailable", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async () => {
        throw new Error("not enumerable");
      }),
      multicall: vi.fn(async () => [
        {
          status: "success",
          result: "0x0000000000000000000000000000000000000009",
        },
        {
          status: "success",
          result: "0x0000000000000000000000000000000000000001",
        },
        {
          status: "failure",
          error: new Error("missing"),
        },
      ]),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            token: {
              collectionId: "random-walk",
              tokenId: 1,
              name: "Random Walk #000001",
              owner: "0x0000000000000000000000000000000000000001",
              seed: "seed",
              traits: [],
              artwork: {
                image:
                  "https://api.randomwalknft.com:1443/images/randomwalk/000001_black_thumb.jpg",
                alt: "Token artwork",
              },
            },
            offers: [],
          }),
        ),
      ),
    );

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /#000001/i })).toBeVisible();
  });
});
