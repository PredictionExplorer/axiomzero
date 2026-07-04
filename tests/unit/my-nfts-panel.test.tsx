import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";

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
        waitForTransactionReceipt?: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
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

  it("asks connected users on the wrong chain to switch to Arbitrum", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      isConnected: true,
    };
    wagmiMock.switchChainAsync.mockResolvedValue(undefined);

    render(<MyNftsPanel collections={[collection]} />);

    const switchButton = screen.getByRole("button", {
      name: /switch to arbitrum/i,
    });
    expect(switchButton).toBeVisible();

    fireEvent.click(switchButton);
    await waitFor(() => {
      expect(wagmiMock.switchChainAsync).toHaveBeenCalledWith({
        chainId: 42161,
      });
    });
  });

  it("keeps waiting for a wallet client before scanning", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = undefined;

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(
        screen.getByText(/connect a wallet to scan your nfts/i),
      ).toBeVisible();
    });
  });

  it("shows skeleton cards while a scan is in flight", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(() => new Promise(() => {})),
      multicall: vi.fn(() => new Promise(() => {})),
    };

    const { container } = render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /scanning/i }),
      ).toBeInTheDocument();
    });
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
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

  it("lists an owned NFT after requesting one-time marketplace approval", async () => {
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
            ? false
            : functionName === "ownerOf"
              ? "0x0000000000000000000000000000000000000001"
              : 0n,
      ),
      multicall: vi.fn(async () => [{ status: "success", result: 7n }]),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
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
              artwork: { image: "/art.png", alt: "Token artwork" },
            },
            offers: [
              {
                id: "low-bid",
                offerId: 21,
                collectionId: "random-walk",
                tokenId: 7,
                kind: "buy",
                priceEth: 0.2,
                maker: "0x0000000000000000000000000000000000000002",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "high-bid",
                offerId: 22,
                collectionId: "random-walk",
                tokenId: 7,
                kind: "buy",
                priceEth: 0.6,
                maker: "0x0000000000000000000000000000000000000003",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "expensive-listing",
                offerId: 23,
                collectionId: "random-walk",
                tokenId: 7,
                kind: "sell",
                priceEth: 3,
                maker: "0x0000000000000000000000000000000000000004",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "floor-listing",
                offerId: 24,
                collectionId: "random-walk",
                tokenId: 7,
                kind: "sell",
                priceEth: 2,
                maker: "0x0000000000000000000000000000000000000005",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        ),
      ),
    );

    render(<MyNftsPanel collections={[collection]} />);

    const priceInput = await screen.findByPlaceholderText("0.5000");
    fireEvent.change(priceInput, { target: { value: "0.75" } });

    fireEvent.click(screen.getByRole("button", { name: /^list nft$/i }));

    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "setApprovalForAll",
          args: [collection.marketplaceAddress, true],
        }),
      );
    });
    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "makeSellOffer",
          args: [collection.nftAddress, 7n, parseEther("0.75")],
        }),
      );
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith("Listing confirmed");
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      "Marketplace approval confirmed",
    );
  });

  it("refuses to list a token the wallet no longer owns", async () => {
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
              ? "0x0000000000000000000000000000000000000009"
              : 0n,
      ),
      multicall: vi.fn(async () => [{ status: "success", result: 7n }]),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => marketResponse("random-walk", 7)),
    );

    render(<MyNftsPanel collections={[collection]} />);

    const priceInput = await screen.findByPlaceholderText("0.5000");
    fireEvent.change(priceInput, { target: { value: "0.75" } });
    fireEvent.click(screen.getByRole("button", { name: /^list nft$/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Listing failed", {
        description: "Only the current token owner can list this NFT.",
      });
    });
    expect(wagmiMock.writeContractAsync).not.toHaveBeenCalled();
  });

  it("reports failed bid acceptance and listing cancellation", async () => {
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
    wagmiMock.writeContractAsync.mockRejectedValue(
      new Error("User rejected the request"),
    );
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
              artwork: { image: "/art.png", alt: "Token artwork" },
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

    fireEvent.click(
      await screen.findByRole("button", { name: /accept bid · 0\.5000 eth/i }),
    );
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Accepting the bid failed",
        { description: "User rejected the request" },
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: /cancel listing · 1\.00 eth/i }),
    );
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "Cancelling the listing failed",
        { description: "User rejected the request" },
      );
    });
  });

  it("surfaces scan failures when every ownership strategy breaks", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async () => {
        throw new Error("RPC exploded");
      }),
      multicall: vi.fn(async () => {
        throw new Error("RPC exploded");
      }),
    };

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/rpc exploded/i)).toBeVisible();
    });
  });

  it("shows the empty state and rescans on demand when nothing is owned", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    const readContract = vi.fn(async () => 0n);
    wagmiMock.publicClient = {
      readContract,
      multicall: vi.fn(async () => []),
    };

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(
        screen.getByText(/no owned nfts were found in the live collection/i),
      ).toBeVisible();
    });
    expect(
      screen.getByRole("heading", { name: /no owned nfts found/i }),
    ).toBeVisible();

    const callsBefore = readContract.mock.calls.length;
    fireEvent.click(
      screen.getByRole("button", { name: /refresh inventory/i }),
    );

    await waitFor(() => {
      expect(readContract.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("sorts owned tokens by highest bid before unbid tokens", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
        functionName === "balanceOf" ? 4n : 0n,
      ),
      multicall: vi.fn(async () => [
        { status: "success", result: 1n },
        { status: "success", result: 2n },
        { status: "success", result: 3n },
        { status: "success", result: 4n },
      ]),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const tokenId = Number(String(input).split("/").at(-1));
        const bids: Record<number, number | undefined> = {
          1: 0.25,
          2: 0.9,
          3: undefined,
          4: undefined,
        };
        const bid = bids[tokenId];

        return new Response(
          JSON.stringify({
            token: {
              collectionId: "random-walk",
              tokenId,
              name: `Random Walk #${tokenId}`,
              owner: "0x0000000000000000000000000000000000000001",
              seed: "seed",
              traits: [],
              artwork: { image: "/art.png", alt: "Token artwork" },
            },
            offers: bid
              ? [
                  {
                    id: `bid-${tokenId}`,
                    offerId: tokenId * 10,
                    collectionId: "random-walk",
                    tokenId,
                    kind: "buy",
                    priceEth: bid,
                    maker: "0x0000000000000000000000000000000000000002",
                    createdAt: "2026-01-01T00:00:00.000Z",
                  },
                ]
              : [],
          }),
        );
      }),
    );

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 4 owned nfts/i)).toBeInTheDocument();
    });

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["#000002", "#000001", "#000003", "#000004"]);
  });

  it("scans the indexed token list when enumeration is unsupported", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "totalSupply") {
          return 3n;
        }
        throw new Error("not enumerable");
      }),
      multicall: vi.fn(
        async ({
          contracts,
        }: {
          contracts: Array<{ functionName: string; args?: readonly unknown[] }>;
        }) => {
          if (contracts[0]?.functionName === "tokenByIndex") {
            return [
              { status: "success", result: 0n },
              { status: "success", result: 2n },
              { status: "failure", error: new Error("gap") },
            ];
          }

          return contracts.map((contract) => ({
            status: "success" as const,
            result:
              contract.args?.[0] === 2n
                ? "0x0000000000000000000000000000000000000001"
                : "0x0000000000000000000000000000000000000009",
          }));
        },
      ),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => marketResponse("random-walk", 2)),
    );

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /#000002/i })).toBeVisible();
  });

  it("treats zero-result enumeration as unsupported and scans the index", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
        functionName === "balanceOf"
          ? 1n
          : functionName === "totalSupply"
            ? 0n
            : 0n,
      ),
      multicall: vi.fn(
        async ({
          contracts,
        }: {
          contracts: Array<{ functionName: string }>;
        }) =>
          contracts.map(() => ({
            status: "failure" as const,
            error: new Error("enumeration unsupported"),
          })),
      ),
    };

    render(<MyNftsPanel collections={[collection]} />);

    // balanceOf said 1 but enumeration produced nothing, so the panel falls
    // through to the (empty) indexed scan and reports no owned NFTs.
    await waitFor(() => {
      expect(
        screen.getByText(/no owned nfts were found in the live collection/i),
      ).toBeVisible();
    });
  });

  it("falls back to the range scan when the token index has gaps only", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "totalSupply") {
          return 2n;
        }
        throw new Error("not enumerable");
      }),
      multicall: vi.fn(
        async ({
          contracts,
        }: {
          contracts: Array<{ functionName: string; args?: readonly unknown[] }>;
        }) => {
          if (contracts[0]?.functionName === "tokenByIndex") {
            return contracts.map(() => ({
              status: "failure" as const,
              error: new Error("index read failed"),
            }));
          }

          return contracts.map((contract) => ({
            status: "success" as const,
            result:
              contract.args?.[0] === 0n
                ? "0x0000000000000000000000000000000000000001"
                : "0x0000000000000000000000000000000000000009",
          }));
        },
      ),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => marketResponse("random-walk", 0)),
    );

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /#000000/i })).toBeVisible();
  });

  it("falls back to the configured token range when totalSupply is invalid", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "totalSupply") {
          return 2n ** 60n;
        }
        throw new Error("not enumerable");
      }),
      multicall: vi.fn(
        async ({
          contracts,
        }: {
          contracts: Array<{ functionName: string; args?: readonly unknown[] }>;
        }) =>
          contracts.map((contract) => ({
            status: "success" as const,
            result:
              contract.args?.[0] === 1n
                ? "0x0000000000000000000000000000000000000001"
                : "0x0000000000000000000000000000000000000009",
          })),
      ),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => marketResponse("random-walk", 1)),
    );

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /#000001/i })).toBeVisible();
  });

  it("skips tokens whose market detail cannot be loaded", async () => {
    wagmiMock.account = {
      address: "0x0000000000000000000000000000000000000001",
      chainId: 42161,
      isConnected: true,
    };
    wagmiMock.publicClient = {
      readContract: vi.fn(async () => 2n),
      multicall: vi.fn(async () => [
        { status: "success", result: 7n },
        { status: "success", result: 8n },
      ]),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        String(input).endsWith("/8")
          ? new Response("", { status: 502 })
          : marketResponse("random-walk", 7),
      ),
    );

    render(<MyNftsPanel collections={[collection]} />);

    await waitFor(() => {
      expect(screen.getByText(/found 1 owned nft/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /#000007/i })).toBeVisible();
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
              UserTokens: [
                { TokenId: 13 },
                { TokenId: 13 },
                { TokenId: "not-a-number" },
                {},
              ],
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

  it("falls back to chain scans when the Cosmic Signature API reports an error status", async () => {
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
        if (String(input).includes("/api/cosmicgame/cst/list/by_user/")) {
          return new Response(
            JSON.stringify({ UserTokens: [], error: "backend", status: 0 }),
          );
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
