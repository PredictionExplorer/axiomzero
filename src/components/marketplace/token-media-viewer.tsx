"use client";

import { useState } from "react";
import Image from "next/image";

import { ArtworkLightbox } from "@/components/marketplace/artwork-lightbox";
import { Button, ButtonLink } from "@/components/ui/button";
import type { MarketToken } from "@/lib/marketplace/types";
import type {
  TokenMediaOption,
  TokenMediaSelection,
  TokenThemeOption,
} from "@/lib/marketplace/token-detail";

export function TokenMediaViewer({
  token,
  selectedMedia,
  themeOptions,
  mediaOptions,
  previousHref,
  nextHref,
  previousThumb,
  nextThumb,
}: {
  token: MarketToken;
  selectedMedia: TokenMediaSelection;
  themeOptions: TokenThemeOption[];
  mediaOptions: TokenMediaOption[];
  previousHref?: string;
  nextHref?: string;
  previousThumb?: string;
  nextThumb?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <section className="space-y-4" aria-label={`${token.name} artwork viewer`}>
      <div className="overflow-hidden rounded-[2.5rem] border border-ivory/10 bg-carbon p-4 shadow-[0_40px_140px_rgba(0,0,0,0.32)]">
        <button
          type="button"
          className="group relative block aspect-square w-full overflow-hidden rounded-[2rem] bg-ink/45"
          onClick={() => {
            if (selectedMedia.type === "image") {
              setLightboxOpen(true);
            }
          }}
          aria-label={`Open ${token.name} artwork in fullscreen`}
        >
          {selectedMedia.type === "image" ? (
            <Image
              src={selectedMedia.src}
              alt={token.artwork.alt}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <video
              src={selectedMedia.src}
              aria-label={`${token.name} ${selectedMedia.media} video`}
              className="h-full w-full object-contain p-4"
              autoPlay
              muted
              loop
              playsInline
              controls
            />
          )}
          {selectedMedia.type === "image" ? (
            <span className="absolute bottom-4 right-4 rounded-full border border-ivory/15 bg-ink/75 px-3 py-1 text-xs uppercase tracking-[0.2em] text-bone">
              Click to zoom
            </span>
          ) : null}
        </button>

        <div className="mt-4 space-y-3">
          {themeOptions.length > 1 ? (
            <ControlGroup label="Artwork theme">
              {themeOptions.map((option) => (
                <ButtonLink
                  key={option.id}
                  href={option.href}
                  variant={option.isActive ? "primary" : "secondary"}
                  className="h-9 px-4"
                  aria-current={option.isActive ? "true" : undefined}
                >
                  {option.label}
                </ButtonLink>
              ))}
            </ControlGroup>
          ) : null}

          {mediaOptions.length > 1 ? (
            <ControlGroup label="Artwork media">
              {mediaOptions.map((option) => (
                <ButtonLink
                  key={option.id}
                  href={option.href}
                  variant={option.isActive ? "primary" : "secondary"}
                  className="h-9 px-4"
                  aria-current={option.isActive ? "true" : undefined}
                >
                  {option.label}
                </ButtonLink>
              ))}
            </ControlGroup>
          ) : null}

          {selectedMedia.unavailableMessage ? (
            <p className="rounded-2xl border border-copper/30 bg-copper/10 px-4 py-3 text-sm text-bone">
              {selectedMedia.unavailableMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-between gap-3">
          <TokenNavButton
            href={previousHref}
            label="Prev token"
            thumb={previousThumb}
          />
          <TokenNavButton href={nextHref} label="Next token" thumb={nextThumb} />
        </div>
      </div>

      {selectedMedia.type === "image" ? (
        <ArtworkLightbox
          src={selectedMedia.src}
          alt={token.artwork.alt}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.22em] text-bone/65">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function TokenNavButton({
  href,
  label,
  thumb,
}: {
  href?: string;
  label: string;
  thumb?: string;
}) {
  if (!href) {
    return (
      <Button type="button" variant="secondary" disabled className="min-w-[8.5rem]">
        {label}
      </Button>
    );
  }

  return (
    <ButtonLink href={href} variant="secondary" className="min-w-[8.5rem] gap-2">
      {thumb ? (
        <span className="relative size-8 overflow-hidden rounded-full border border-ivory/15">
          <Image src={thumb} alt="" fill sizes="32px" className="object-cover" />
        </span>
      ) : null}
      {label}
    </ButtonLink>
  );
}
