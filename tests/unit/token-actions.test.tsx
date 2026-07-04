import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";

import type { Collection, MarketOffer } from "@/lib/marketplace/types";

const wagmiMock = vi.hoisted(() => ({
  account: {
    address: undefined as `0x${string}` | undefined,
    chainId: undefined as number | undefined,
    isConnected: false,
  },
  switchChainAsync: vi.fn(),
  writeContractAsync: vi.fn(),
  routerRefresh: vi.fn(),
  publicClient: undefined as
    | {
        readContract: ReturnType<typeof vi.fn>;
        waitForTransactionReceipt: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: wagmiMock.routerRefresh }),
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

import { TokenActions } from "@/components/marketplace/token-actions";

const ownerAddress = "0x0000000000000000000000000000000000000001" as const;
const visitorAddress = "0x0000000000000000000000000000000000000002" as const;

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

function offer(overrides: Partial<MarketOffer> & { id: string }): MarketOffer {
  return {
    collectionId: "random-walk",
    tokenId: 7,
    kind: "sell",
    priceEth: 1,
    maker: visitorAddress,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function connectWallet(address: `0x${string}`, chainId = 42161) {
  wagmiMock.account = { address, chainId, isConnected: true };
}

function stubChainReads({
  owner,
  approved,
}: {
  owner: `0x${string}`;
  approved: boolean;
}) {
  wagmiMock.publicClient = {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "ownerOf") {
        return owner;
      }
      if (functionName === "isApprovedForAll") {
        return approved;
      }
      throw new Error(`Unexpected read: ${functionName}`);
    }),
    waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
  };
}

describe("TokenActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wagmiMock.account = {
      address: undefined,
      chainId: undefined,
      isConnected: false,
    };
    wagmiMock.publicClient = undefined;
    wagmiMock.writeContractAsync.mockResolvedValue("0xhash");
  });

  it("prompts disconnected visitors to connect before trading", () => {
    render(
      <TokenActions collection={collection} tokenId={7} offers={[]} />,
    );

    expect(
      screen.getByRole("heading", { name: /bid on this nft/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/connect a wallet to activate trading controls/i)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /^bid$/i })).toBeDisabled();
  });

  it("offers a chain switch when the wallet is on the wrong network", async () => {
    connectWallet(ownerAddress, 1);
    stubChainReads({ owner: ownerAddress, approved: true });
    wagmiMock.switchChainAsync.mockResolvedValue(undefined);

    render(
      <TokenActions collection={collection} tokenId={7} offers={[]} />,
    );

    expect(
      screen.getAllByText(/switch to arbitrum to trade through the marketplace/i)
        .length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /switch to arbitrum/i }));

    await waitFor(() => {
      expect(wagmiMock.switchChainAsync).toHaveBeenCalledWith({
        chainId: 42161,
      });
    });
  });

  it("lists the NFT for an approved owner and refreshes state", async () => {
    connectWallet(ownerAddress);
    stubChainReads({ owner: ownerAddress, approved: true });

    render(
      <TokenActions collection={collection} tokenId={7} offers={[]} />,
    );

    expect(
      await screen.findByText(/connected wallet owns this token/i),
    ).toBeVisible();
    expect(screen.getByText(/^approved$/i)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /list this nft/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("0.5000"), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^list this nft$/i }));

    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "makeSellOffer",
          args: [collection.nftAddress, 7n, parseEther("0.5")],
        }),
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Transaction confirmed");
    });
    expect(
      wagmiMock.publicClient?.waitForTransactionReceipt,
    ).toHaveBeenCalledWith({ hash: "0xhash" });
    expect(wagmiMock.routerRefresh).toHaveBeenCalled();
  });

  it("requests marketplace approval before listing when it is missing", async () => {
    connectWallet(ownerAddress);
    stubChainReads({ owner: ownerAddress, approved: false });

    render(
      <TokenActions collection={collection} tokenId={7} offers={[]} />,
    );

    expect(await screen.findByText(/approval required/i)).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText("0.5000"), {
      target: { value: "0.25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /approve and list/i }));

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
          args: [collection.nftAddress, 7n, parseEther("0.25")],
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Marketplace approval confirmed",
    );
  });

  it("surfaces the highest outside bid to the owner and accepts it", async () => {
    connectWallet(ownerAddress);
    stubChainReads({ owner: ownerAddress, approved: true });
    const offers = [
      offer({ id: "low-bid", kind: "buy", offerId: 11, priceEth: 0.25 }),
      offer({ id: "high-bid", kind: "buy", offerId: 12, priceEth: 0.75 }),
    ];

    render(
      <TokenActions collection={collection} tokenId={7} offers={offers} />,
    );

    const acceptButton = await screen.findByRole("button", {
      name: /accept bid for 0\.7500 eth/i,
    });
    expect(
      screen.getByText(/highest bid on your nft/i),
    ).toBeVisible();

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "acceptBuyOffer",
          args: [12n],
        }),
      );
    });
  });

  it("lets a visitor buy the active listing at the listed price", async () => {
    connectWallet(visitorAddress);
    stubChainReads({ owner: ownerAddress, approved: false });
    const activeSellOffer = offer({
      id: "listing",
      offerId: 40,
      kind: "sell",
      priceEth: 1,
      maker: ownerAddress,
    });

    render(
      <TokenActions
        collection={collection}
        tokenId={7}
        activeSellOffer={activeSellOffer}
        offers={[activeSellOffer]}
      />,
    );

    expect(await screen.findByText(/view-only wallet/i)).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: /buy now for 1\.00 eth/i }),
    );

    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "acceptSellOffer",
          args: [40n],
          value: parseEther("1"),
        }),
      );
    });
  });

  it("blocks buying your own listing", async () => {
    connectWallet(ownerAddress);
    stubChainReads({ owner: ownerAddress, approved: true });
    const activeSellOffer = offer({
      id: "listing",
      offerId: 40,
      kind: "sell",
      priceEth: 1,
      maker: ownerAddress,
    });

    render(
      <TokenActions
        collection={collection}
        tokenId={7}
        activeSellOffer={activeSellOffer}
        offers={[activeSellOffer]}
      />,
    );

    expect(
      await screen.findByText(/you cannot buy your own listing/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /buy now for 1\.00 eth/i }),
    ).toBeDisabled();
  });

  it("disables buying when the listing has no on-chain offer id", async () => {
    connectWallet(visitorAddress);
    stubChainReads({ owner: ownerAddress, approved: false });
    const activeSellOffer = offer({
      id: "listing",
      kind: "sell",
      priceEth: 1,
      maker: ownerAddress,
    });

    render(
      <TokenActions
        collection={collection}
        tokenId={7}
        activeSellOffer={activeSellOffer}
        offers={[activeSellOffer]}
      />,
    );

    expect(
      await screen.findByText(/did not include an offer/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /buy now for 1\.00 eth/i }),
    ).toBeDisabled();
  });

  it("places a bid for a visitor and blocks listing someone else's NFT", async () => {
    connectWallet(visitorAddress);
    stubChainReads({ owner: ownerAddress, approved: false });

    render(
      <TokenActions collection={collection} tokenId={7} offers={[]} />,
    );

    expect(await screen.findByText(/view-only wallet/i)).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText("0.5000"), {
      target: { value: "0.3" },
    });

    expect(
      screen.getByText(/only the current owner can list this nft/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /approve and list/i }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^bid$/i }));

    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "makeBuyOffer",
          args: [collection.nftAddress, 7n],
          value: parseEther("0.3"),
        }),
      );
    });
  });

  it("pre-fills the price input from the top bid and listing chips", async () => {
    connectWallet(visitorAddress);
    stubChainReads({ owner: ownerAddress, approved: false });
    const activeSellOffer = offer({
      id: "listing",
      offerId: 40,
      kind: "sell",
      priceEth: 1.5,
      maker: ownerAddress,
    });
    const offers = [
      activeSellOffer,
      offer({ id: "bid", kind: "buy", offerId: 41, priceEth: 0.8 }),
    ];

    render(
      <TokenActions
        collection={collection}
        tokenId={7}
        activeSellOffer={activeSellOffer}
        offers={offers}
      />,
    );

    const input = screen.getByPlaceholderText<HTMLInputElement>("0.5000");

    fireEvent.click(screen.getByRole("button", { name: /top bid · 0\.8000 eth/i }));
    expect(input.value).toBe("0.8");

    fireEvent.click(screen.getByRole("button", { name: /listing · 1\.50 eth/i }));
    expect(input.value).toBe("1.5");
  });

  it("cancels the connected wallet's own listings and bids", async () => {
    connectWallet(visitorAddress);
    stubChainReads({ owner: ownerAddress, approved: false });
    const offers = [
      offer({ id: "own-listing", offerId: 50, kind: "sell", priceEth: 2 }),
      offer({ id: "own-bid", offerId: 51, kind: "buy", priceEth: 0.4 }),
      offer({ id: "foreign", offerId: 52, kind: "buy", maker: ownerAddress }),
      offer({ id: "no-chain-id", kind: "buy" }),
    ];

    render(
      <TokenActions collection={collection} tokenId={7} offers={offers} />,
    );

    expect(await screen.findByText(/your active orders/i)).toBeVisible();
    expect(screen.getByText(/listing · 2\.00 eth/i)).toBeVisible();
    expect(screen.getByText(/bid · 0\.4000 eth/i)).toBeVisible();

    const cancelButtons = screen.getAllByRole("button", { name: /^cancel$/i });
    expect(cancelButtons).toHaveLength(2);

    fireEvent.click(cancelButtons[0]);
    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "cancelSellOffer",
          args: [50n],
        }),
      );
    });

    fireEvent.click(cancelButtons[1]);
    await waitFor(() => {
      expect(wagmiMock.writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "cancelBuyOffer",
          args: [51n],
        }),
      );
    });
  });

  it("approves the marketplace before accepting a bid when needed", async () => {
    connectWallet(ownerAddress);
    stubChainReads({ owner: ownerAddress, approved: false });
    const offers = [
      offer({ id: "bid", kind: "buy", offerId: 12, priceEth: 0.5 }),
    ];

    render(
      <TokenActions collection={collection} tokenId={7} offers={offers} />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /approve and accept bid/i }),
    );

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
          functionName: "acceptBuyOffer",
          args: [12n],
        }),
      );
    });
  });

  it("fails transactions safely when the RPC client is missing", async () => {
    connectWallet(visitorAddress);
    wagmiMock.publicClient = undefined;
    const activeSellOffer = offer({
      id: "listing",
      offerId: 40,
      kind: "sell",
      priceEth: 1,
      maker: ownerAddress,
    });
    const offers = [
      activeSellOffer,
      offer({ id: "own-bid", offerId: 51, kind: "buy", priceEth: 0.4 }),
    ];

    render(
      <TokenActions
        collection={collection}
        tokenId={7}
        activeSellOffer={activeSellOffer}
        offers={offers}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("0.5000"), {
      target: { value: "0.3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^bid$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Transaction failed", {
        description: "Connect your wallet to continue.",
      });
    });

    fireEvent.click(
      screen.getByRole("button", { name: /buy now for 1\.00 eth/i }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(3);
    });
    // Listing stays blocked because ownership cannot be verified.
    expect(
      screen.getByRole("button", { name: /approve and list/i }),
    ).toBeDisabled();
    expect(wagmiMock.writeContractAsync).not.toHaveBeenCalled();
  });

  it("shows an error when token state cannot be loaded", async () => {
    connectWallet(visitorAddress);
    wagmiMock.publicClient = {
      readContract: vi.fn(async () => {
        throw new Error("RPC unavailable");
      }),
      waitForTransactionReceipt: vi.fn(),
    };

    render(
      <TokenActions collection={collection} tokenId={7} offers={[]} />,
    );

    expect(await screen.findByText(/rpc unavailable/i)).toBeVisible();
  });

  it("reports failed transactions with an error toast", async () => {
    connectWallet(ownerAddress);
    stubChainReads({ owner: ownerAddress, approved: true });
    wagmiMock.writeContractAsync.mockRejectedValue(
      new Error("User rejected the request"),
    );

    render(
      <TokenActions collection={collection} tokenId={7} offers={[]} />,
    );

    expect(
      await screen.findByText(/connected wallet owns this token/i),
    ).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText("0.5000"), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^list this nft$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Transaction failed", {
        description: "User rejected the request",
      });
    });
    expect(wagmiMock.routerRefresh).not.toHaveBeenCalled();
  });
});
