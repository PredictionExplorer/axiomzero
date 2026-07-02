import Image from "next/image";

import { collections } from "@/config/collections";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import type { HomeArtworkItem } from "@/lib/marketplace/home-data";
import { collectionPath, tokenPath } from "@/lib/marketplace/routes";

export function ArtSystemsSection({
  showcases,
}: {
  showcases: Array<HomeArtworkItem | undefined>;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <Reveal>
        <p className="text-sm uppercase tracking-[0.34em] text-copper">
          The art systems
        </p>
        <h2 className="font-display mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-ivory sm:text-5xl">
          Mathematics and physics, rendered as collectible generative art.
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {collections.map((collection, index) => {
          const showcase = showcases[index];

          return (
            <Reveal key={collection.id} delayMs={index * 100}>
              <article
                data-accent={collection.accent}
                className="group relative overflow-hidden rounded-[2.5rem] border border-accent"
              >
                {showcase ? (
                  <div className="absolute inset-0">
                    <Image
                      src={showcase.artwork.image}
                      alt={showcase.artwork.alt}
                      fill
                      sizes="(min-width: 1024px) 40vw, 100vw"
                      className="object-cover opacity-35 transition duration-700 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/30" />
                  </div>
                ) : null}

                <div className="relative p-6 sm:p-8">
                  <p className="text-xs uppercase tracking-[0.28em] text-accent">
                    {collection.artSystem}
                  </p>
                  <h3 className="font-display mt-3 text-3xl font-semibold text-ivory">
                    {collection.shortName}
                  </h3>
                  <p className="mt-4 max-w-xl leading-7 text-bone/78">
                    {collection.description}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <ButtonLink href={collectionPath(collection.id)}>
                      Explore market
                    </ButtonLink>
                    {showcase ? (
                      <ButtonLink
                        href={tokenPath(showcase.collectionId, showcase.tokenId)}
                        variant="secondary"
                      >
                        View featured token
                      </ButtonLink>
                    ) : null}
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
