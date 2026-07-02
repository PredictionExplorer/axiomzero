import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import type { HomeArtworkItem } from "@/lib/marketplace/home-data";
import {
  collectionPath,
  MY_NFTS_PATH,
  tokenPath,
} from "@/lib/marketplace/routes";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const mosaicSpans = [
  "col-span-3 row-span-3",
  "col-span-3 row-span-3",
  "col-span-2 row-span-3",
  "col-span-2 row-span-3",
  "col-span-2 row-span-3",
  "col-span-6 row-span-2",
];

export function HomeHero({ artworks }: { artworks: HomeArtworkItem[] }) {
  const mosaic = artworks.slice(0, 6);

  return (
    <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:py-28">
      <Reveal className="flex flex-col justify-center">
        <p className="text-sm uppercase tracking-[0.42em] text-copper">
          {BRAND_NAME}
        </p>
        <h1 className="font-display mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-ivory sm:text-7xl lg:text-8xl">
          A fair market for art made from first principles.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-bone/74">
          {BRAND_TAGLINE} Browse Random Walk and Cosmic Signature NFTs in a
          0% fee market built for fair-launch generative art.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={MY_NFTS_PATH}>My NFTs</ButtonLink>
          <ButtonLink href={collectionPath("random-walk")} variant="secondary">
            Random Walk
          </ButtonLink>
          <ButtonLink
            href={collectionPath("cosmic-signature")}
            variant="secondary"
          >
            Cosmic Signature
          </ButtonLink>
        </div>
      </Reveal>

      <Reveal delayMs={120} className="relative min-h-[520px]">
        <div className="absolute inset-0 rounded-[2.5rem] border border-ivory/10 bg-ivory/[0.04] shadow-[0_40px_140px_rgba(0,0,0,0.34)]" />
        {mosaic.length ? (
          <div className="relative grid h-full min-h-[520px] grid-cols-6 grid-rows-8 gap-3 p-5">
            {mosaic.map((item, index) => (
              <Link
                key={`${item.collectionId}-${item.tokenId}`}
                href={tokenPath(item.collectionId, item.tokenId)}
                className={`group relative overflow-hidden rounded-[1.5rem] border border-ivory/10 bg-carbon ${mosaicSpans[index]}`}
              >
                <Image
                  src={item.artwork.image}
                  alt={item.artwork.alt}
                  fill
                  sizes="(min-width: 1024px) 28vw, 50vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.05]"
                  priority={index < 2}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-3 opacity-0 transition duration-300 group-hover:opacity-100">
                  <p className="text-xs uppercase tracking-[0.2em] text-bone/90">
                    {item.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="relative grid h-full min-h-[520px] place-items-center p-5">
            <div className="absolute h-[28rem] w-[28rem] rounded-full border border-copper/40" />
            <div className="absolute h-[19rem] w-[19rem] rotate-45 rounded-full border border-chartreuse/30" />
            <div className="relative max-w-sm rounded-[2rem] border border-ivory/10 bg-ink/82 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.28em] text-chartreuse">
                zero means zero
              </p>
              <p className="font-display mt-4 text-3xl font-semibold tracking-[-0.04em] text-ivory">
                No founder allocations. No allowlists. No insider lane.
              </p>
            </div>
          </div>
        )}
      </Reveal>
    </section>
  );
}
