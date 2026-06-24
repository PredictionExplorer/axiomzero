import type { MarketOffer, MarketToken } from "@/lib/marketplace/types";

const address = (suffix: string) =>
  `0x${suffix.padStart(40, "0")}` as `0x${string}`;

export const tokens = [
  {
    collectionId: "random-walk",
    tokenId: 1271,
    name: "Random Walk #001271",
    owner: address("a1271"),
    seed: "0x7c8d58b4b7b98693b7db5a1d74e2c513f2ce2a291b4eabf08c54c2bd75d71271",
    traits: [
      { label: "Motion", value: "Braided drift" },
      { label: "Density", value: "Sparse" },
      { label: "Palette", value: "Ink on ivory" },
    ],
    artwork: {
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'%3E%3Crect width='900' height='900' fill='%23f4eee2'/%3E%3Cg fill='none' stroke='%231a1611' stroke-width='7' stroke-linecap='round'%3E%3Cpath d='M101 540C196 340 289 709 389 472S589 186 771 318'/%3E%3Cpath d='M131 624C239 488 271 598 361 421S531 251 756 219' stroke='%23b65f2a'/%3E%3Cpath d='M116 277C237 427 348 229 461 382S646 609 780 505' stroke='%238b3f21'/%3E%3C/g%3E%3C/svg%3E",
      alt: "Abstract random walk with copper plotted lines on ivory.",
    },
  },
  {
    collectionId: "random-walk",
    tokenId: 3244,
    name: "Random Walk #003244",
    owner: address("b3244"),
    seed: "0xd1cc47a99f7fd8fa52d318398c7e932b090717b34f64ff747af6bd8b5b2b3244",
    traits: [
      { label: "Motion", value: "Hard turn" },
      { label: "Density", value: "High" },
      { label: "Palette", value: "Carbon trace" },
    ],
    artwork: {
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'%3E%3Crect width='900' height='900' fill='%23120f0a'/%3E%3Cg fill='none' stroke='%23f7efe2' stroke-width='5' stroke-linejoin='round'%3E%3Cpath d='M108 138 206 283 157 398 309 469 282 709 509 640 641 751 782 612'/%3E%3Cpath d='M166 699 263 574 228 413 396 298 511 371 640 242 748 341' stroke='%23d87932'/%3E%3Cpath d='M93 418 242 372 384 504 533 477 662 589 805 524' stroke='%23d7ff5f'/%3E%3C/g%3E%3C/svg%3E",
      alt: "Dense random walk with ivory, ember, and chartreuse traces on carbon.",
    },
  },
  {
    collectionId: "cosmic-signature",
    tokenId: 11,
    name: "Cosmic Signature #000011",
    owner: address("c0011"),
    seed: "0x4b6a344f4255c53a0d9534d2d75dd0f012b3d623546eb061b9cfbc3f74650011",
    traits: [
      { label: "System", value: "Three-body" },
      { label: "Drift", value: "Elliptic" },
      { label: "Spectrum", value: "Sixteen-bin" },
    ],
    artwork: {
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'%3E%3Crect width='900' height='900' fill='%230d0c08'/%3E%3Cg fill='none' stroke-width='4' opacity='.95'%3E%3Cellipse cx='450' cy='450' rx='310' ry='118' stroke='%23d7ff5f' transform='rotate(-24 450 450)'/%3E%3Cellipse cx='450' cy='450' rx='238' ry='332' stroke='%23f08a38' transform='rotate(38 450 450)'/%3E%3Cellipse cx='450' cy='450' rx='148' ry='401' stroke='%23f4eee2' transform='rotate(82 450 450)'/%3E%3C/g%3E%3Cg fill='%23f4eee2'%3E%3Ccircle cx='287' cy='382' r='12'/%3E%3Ccircle cx='613' cy='524' r='10' fill='%23d7ff5f'/%3E%3Ccircle cx='452' cy='183' r='8' fill='%23f08a38'/%3E%3C/g%3E%3C/svg%3E",
      alt: "Three orbital paths around bright bodies on a dark field.",
    },
  },
  {
    collectionId: "cosmic-signature",
    tokenId: 38,
    name: "Cosmic Signature #000038",
    owner: address("c0038"),
    seed: "0xa6d99107f8f97ee8a1a62c0fb2d0841e5a5c03df4d18d4de9d5f11178f8f0038",
    traits: [
      { label: "System", value: "Chaotic orbit" },
      { label: "Drift", value: "Slow parallax" },
      { label: "Bloom", value: "AgX" },
    ],
    artwork: {
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'%3E%3Crect width='900' height='900' fill='%23f3ead8'/%3E%3Cg fill='none' stroke-width='6' stroke-linecap='round'%3E%3Cpath d='M130 471c133-186 244-209 335-71s180 198 306 53' stroke='%231a1611'/%3E%3Cpath d='M150 356c91 221 283 246 416 74s159-159 213-98' stroke='%23bc6128'/%3E%3Cpath d='M227 672c-30-221 172-376 356-334s180 209 99 332' stroke='%23768f21'/%3E%3C/g%3E%3C/svg%3E",
      alt: "Chaotic three-body paths in ink, copper, and olive on warm paper.",
    },
  },
] satisfies MarketToken[];

export const offers = [
  {
    id: "rw-1271-sell",
    collectionId: "random-walk",
    tokenId: 1271,
    kind: "sell",
    priceEth: 0.1,
    maker: address("f1271"),
    createdAt: "2026-06-24T16:20:00.000Z",
  },
  {
    id: "rw-3244-sell",
    collectionId: "random-walk",
    tokenId: 3244,
    kind: "sell",
    priceEth: 77,
    maker: address("f3244"),
    createdAt: "2026-06-24T13:05:00.000Z",
  },
  {
    id: "rw-3244-buy",
    collectionId: "random-walk",
    tokenId: 3244,
    kind: "buy",
    priceEth: 40,
    maker: address("b3244"),
    createdAt: "2026-06-23T21:35:00.000Z",
  },
  {
    id: "cs-11-sell",
    collectionId: "cosmic-signature",
    tokenId: 11,
    kind: "sell",
    priceEth: 1.95,
    maker: address("f0011"),
    createdAt: "2026-06-24T15:42:00.000Z",
  },
  {
    id: "cs-38-buy",
    collectionId: "cosmic-signature",
    tokenId: 38,
    kind: "buy",
    priceEth: 3.2,
    maker: address("b0038"),
    createdAt: "2026-06-24T09:00:00.000Z",
  },
] satisfies MarketOffer[];
