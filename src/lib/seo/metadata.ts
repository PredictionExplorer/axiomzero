import type { Metadata } from "next";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/brand";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://axiomzero.market";

export const SITE_KEYWORDS = [
  "Axiom Zero",
  "generative art NFT",
  "Random Walk NFT",
  "Cosmic Signature NFT",
  "Arbitrum NFT marketplace",
  "zero fee NFT marketplace",
  "fair launch NFT",
  "mathematical art",
  "algorithmic art",
] as const;

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function buildPageMetadata({
  title,
  description = BRAND_DESCRIPTION,
  path,
  image,
  keywords = [...SITE_KEYWORDS],
}: {
  title: string;
  description?: string;
  path: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  const canonical = absoluteUrl(path);
  const ogImage = image ?? absoluteUrl("/opengraph-image");

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      title: `${title} | ${BRAND_NAME}`,
      description,
      type: "website",
      url: canonical,
      siteName: BRAND_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${BRAND_NAME}`,
      description,
      images: [ogImage],
    },
  };
}
