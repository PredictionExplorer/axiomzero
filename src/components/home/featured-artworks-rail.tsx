import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/ui/reveal";
import type { HomeArtworkItem } from "@/lib/marketplace/home-data";
import { tokenPath } from "@/lib/marketplace/routes";
import { formatEth } from "@/lib/utils";

export function FeaturedArtworksRail({
  items,
}: {
  items: HomeArtworkItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <Reveal>
        <p className="text-sm uppercase tracking-[0.34em] text-copper">
          Featured listings
        </p>
        <h2 className="font-display mt-4 text-4xl font-semibold tracking-[-0.05em] text-ivory">
          Live works on the market
        </h2>
      </Reveal>

      <div className="mt-8 flex gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <Reveal
            key={`${item.collectionId}-${item.tokenId}`}
            delayMs={index * 60}
          >
            <Link
              href={tokenPath(item.collectionId, item.tokenId)}
              className="group block w-[17rem] shrink-0 overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] transition hover:-translate-y-1 hover:border-copper/35"
            >
              <div className="relative aspect-square bg-carbon">
                <Image
                  src={item.artwork.image}
                  alt={item.artwork.alt}
                  fill
                  sizes="17rem"
                  className="object-contain p-4 transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-bone/70">
                  {item.name}
                </p>
                <p className="font-display mt-2 text-2xl font-semibold text-chartreuse">
                  {item.priceEth !== undefined
                    ? formatEth(item.priceEth)
                    : "Unlisted"}
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
