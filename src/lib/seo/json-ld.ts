import { collections } from "@/config/collections";
import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_TAGLINE,
} from "@/lib/brand";
import { ALL_FAQ_ITEMS, type FaqItem } from "@/lib/faq";
import { absoluteUrl } from "@/lib/seo/metadata";

type JsonLd = Record<string, unknown>;

export function jsonLdScript(data: JsonLd | JsonLd[]) {
  return {
    __html: JSON.stringify(data),
  };
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: absoluteUrl("/"),
    description: BRAND_DESCRIPTION,
    slogan: BRAND_TAGLINE,
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: absoluteUrl("/"),
    description: BRAND_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/random-walk")}?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function collectionPageJsonLd({
  name,
  description,
  path,
  itemCount,
}: {
  name: string;
  description: string;
  path: string;
  itemCount: number;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemCount,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
    },
  };
}

export function tokenArtworkJsonLd({
  name,
  description,
  path,
  image,
  collectionName,
  priceEth,
  priceCurrency = "ETH",
}: {
  name: string;
  description: string;
  path: string;
  image: string;
  collectionName: string;
  priceEth?: number;
  priceCurrency?: string;
}): JsonLd {
  const artwork: JsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name,
    description,
    url: absoluteUrl(path),
    image,
    artMedium: "Digital",
    creator: {
      "@type": "Organization",
      name: collectionName,
    },
  };

  if (priceEth !== undefined) {
    artwork.offers = {
      "@type": "Offer",
      price: priceEth,
      priceCurrency,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(path),
    };
  }

  return artwork;
}

export function faqPageJsonLd(
  items: readonly FaqItem[] = ALL_FAQ_ITEMS,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function contractsForLlms() {
  return collections.map((collection) => ({
    collection: collection.shortName,
    nftContract: collection.nftAddress,
    marketplaceContract: collection.marketplaceAddress,
    externalSite: collection.externalUrl,
  }));
}
