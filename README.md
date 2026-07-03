# Axiom Zero

Axiom Zero is a production-minded marketplace for Random Walk NFTs and Cosmic
Signature NFTs on Arbitrum. The brand principle is simple: generative art,
equal access, zero privilege.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS v4
- Wagmi, Viem, RainbowKit, TanStack Query
- Next.js route handlers for normalized marketplace reads
- Vitest, Testing Library, fast-check, Playwright, axe, Lighthouse CI
- Vercel-ready server-rendered pages with small wallet client islands

## Local Development

```bash
corepack pnpm install
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `env.example` to `.env.local` and fill in production values before wallet
testing or deployment.

Wallet connections require a real `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
Deployments still build without it so the marketplace remains browsable, but a
real project ID should be configured in Vercel for reliable WalletConnect QR and
mobile wallet support. Marketplace reads use the existing Random Walk backend
plus verified Arbitrum contract reads; keep the backend URLs and contract
addresses in `env.example` aligned with production sources.

## Marketplace Architecture

The UI reads normalized marketplace data through `src/app/api/marketplace/**`.
Random Walk data is sourced from the existing backend that powers
`randomwalknft.com`, while Cosmic Signature offers are read from the configured
Arbitrum marketplace contract. Wallet actions are signed client-side with wagmi
and viem, then the app refreshes server-rendered data after confirmations.

## Quality Gates

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm test:e2e
```

## Deployment

Deploy on Vercel with Node 20+ and the variables listed in `env.example`.
Verify all contract addresses against official Random Walk and Cosmic Signature
sources before enabling real trading flows in production.

Set `ARBITRUM_RPC_URL` to a dedicated provider endpoint (Alchemy, Infura,
QuickNode, ...) in production. Without it the app falls back to the public
`arb1.arbitrum.io/rpc` endpoint, which rate-limits shared hosting IPs and
intermittently fails the on-chain offer scans, baking "N/A" market stats into
statically cached pages.

## Brand Notes

Axiom Zero avoids blue and purple entirely. The visual system uses ink, carbon,
warm ivory, copper, ember, and chartreuse to feel precise, elegant, and
memorable without turning the market into a casino-like interface.

The marketplace should remain calm under pressure: clear filters, readable
prices, obvious wallet states, accessible focus rings, strong contrast, and
minimal motion.
