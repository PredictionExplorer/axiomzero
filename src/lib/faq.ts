export type FaqItem = {
  question: string;
  answer: string;
  /** Featured items surface in the home page FAQ teaser. */
  featured?: boolean;
};

export type FaqCategory = {
  id: string;
  title: string;
  description: string;
  items: readonly FaqItem[];
};

export const FAQ_CATEGORIES: readonly FaqCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "What Axiom Zero is and what you need before your first trade.",
    items: [
      {
        question: "What is Axiom Zero?",
        answer:
          "Axiom Zero is a zero-fee NFT marketplace for fair-launch generative art collections on Arbitrum, including Random Walk and Cosmic Signature. Every artwork is produced by mathematics, code, and algorithms, and every trade settles directly on-chain.",
        featured: true,
      },
      {
        question: "What do I need to start collecting?",
        answer:
          "You need an Ethereum wallet (such as MetaMask or Rainbow) connected to the Arbitrum network, plus some ETH on Arbitrum for purchases and network gas. Browsing the marketplace requires no wallet at all.",
        featured: true,
      },
      {
        question: "How do I connect my wallet?",
        answer:
          "Press Connect wallet in the header and choose your wallet provider. If your wallet is on a different network, the site prompts you to switch to Arbitrum. Axiom Zero never takes custody of your assets; every action is signed in your own wallet.",
      },
      {
        question: "Do I need an account or sign-up?",
        answer:
          "No. There are no accounts, emails, or passwords. Your wallet address is your identity, and all listings, bids, and purchases are recorded on the Arbitrum blockchain.",
      },
    ],
  },
  {
    id: "buying-bidding",
    title: "Buying and bidding",
    description: "How purchases and bids work on the on-chain order book.",
    items: [
      {
        question: "How do I buy an NFT on Axiom Zero?",
        answer:
          "Open a token detail page and press Buy now on an active listing, then confirm the transaction in your wallet. Ownership transfers to your address as soon as the transaction confirms on Arbitrum.",
        featured: true,
      },
      {
        question: "How do I place a bid?",
        answer:
          "Open the token page for the NFT you want, enter your bid amount in ETH under Market actions, and press Bid. Your ETH is held by the verified marketplace contract while the bid is active.",
      },
      {
        question: "What is the difference between a listing and a bid?",
        answer:
          "A listing is a sell offer: the owner names a price that anyone can accept instantly with Buy now. A bid is a buy offer: a collector locks ETH behind a price, and the bid stays open on-chain until it is accepted or cancelled. Both sit in the same on-chain order book.",
      },
      {
        question: "Can I cancel a bid or get my ETH back?",
        answer:
          "Yes. Your active bids appear under Your active orders on the token page. Press Cancel and confirm in your wallet; the marketplace contract returns your escrowed ETH. You only spend network gas.",
      },
    ],
  },
  {
    id: "selling-listings",
    title: "Selling and listings",
    description: "Listing NFTs you own and managing your open orders.",
    items: [
      {
        question: "How do I list an NFT for sale?",
        answer:
          "Open My NFTs or the token page while connected as the owner, enter your price in ETH, and press List this NFT. The first listing for a collection also asks for a one-time marketplace approval before the sell offer is created.",
      },
      {
        question: "What is marketplace approval?",
        answer:
          "Marketplace approval is a standard ERC-721 permission that lets the verified marketplace contract transfer NFTs from a collection on your behalf when a sale completes. It is granted once per collection and can be revoked from your wallet at any time.",
      },
      {
        question: "How do I cancel a listing?",
        answer:
          "Open the token page while connected with the wallet that created the listing, find it under Your active orders, and press Cancel. The NFT never leaves your wallet while it is listed; cancelling simply removes the on-chain sell offer.",
      },
      {
        question: "When do I get paid after a sale?",
        answer:
          "Immediately. Sales settle atomically on-chain: the same transaction that transfers the NFT to the buyer sends the full sale amount to you. Axiom Zero adds no platform fee on top.",
      },
    ],
  },
  {
    id: "fees-trust",
    title: "Fees and trust",
    description: "What trading costs and how to verify everything yourself.",
    items: [
      {
        question: "Does Axiom Zero charge marketplace fees?",
        answer:
          "No. Axiom Zero adds no platform fee to trades: 0%. Buyers pay only the listing or bid price plus Arbitrum network gas, and sellers receive the full sale amount.",
        featured: true,
      },
      {
        question: "What is gas and who pays it?",
        answer:
          "Gas is the small fee the Arbitrum network charges to process any transaction. It goes to the network, not to Axiom Zero, and is typically a small fraction of Ethereum mainnet costs. Browsing the marketplace is always free.",
      },
      {
        question: "How can I verify the contracts?",
        answer:
          "Every NFT and marketplace contract address is printed in the site footer with a direct Arbiscan link, so you can inspect the verified source code and the full transaction history yourself.",
      },
      {
        question: "What does zero privilege mean?",
        answer:
          "No founder allocations, no allowlists, no insider mint lanes, and no platform fee. Every collector meets the same market at the same time under the same transparent rules.",
      },
    ],
  },
  {
    id: "collections-artwork",
    title: "Collections and artwork",
    description: "The art systems behind the tokens and the data on each page.",
    items: [
      {
        question: "What collections are listed on Axiom Zero?",
        answer:
          "Random Walk NFTs, generative art drawn by five-dimensional random walks, and Cosmic Signature NFTs, orbital signatures rendered from three-body physics. Both trade through verified contracts on Arbitrum.",
      },
      {
        question: "What is a seed?",
        answer:
          "The seed is the unique on-chain value that deterministically generates a token's artwork. The same seed always produces the same artwork, so it acts as the cryptographic fingerprint of the piece. It is shown on every token detail page.",
      },
      {
        question: "What is a beauty score?",
        answer:
          "Beauty is a numeric aesthetic score that ships with Random Walk token metadata. It is descriptive only: it does not change ownership, trading rules, or fees on Axiom Zero. Tokens without a published score simply omit the badge.",
      },
      {
        question: "What are provenance and token history?",
        answer:
          "Provenance is the recorded life of a token: its mint, transfers, and sales with prices where available. Axiom Zero shows it on each token page under the History tab, combining collection endpoints with on-chain marketplace data.",
      },
    ],
  },
] as const;

export const ALL_FAQ_ITEMS: readonly FaqItem[] = FAQ_CATEGORIES.flatMap(
  (category) => [...category.items],
);

export const FEATURED_FAQ_ITEMS: readonly FaqItem[] = ALL_FAQ_ITEMS.filter(
  (item) => item.featured,
);
