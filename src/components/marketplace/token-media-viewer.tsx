import type { ReactNode } from "react";
import Image from "next/image";

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
}: {
  token: MarketToken;
  selectedMedia: TokenMediaSelection;
  themeOptions: TokenThemeOption[];
  mediaOptions: TokenMediaOption[];
  previousHref?: string;
  nextHref?: string;
}) {
  return (
    <section className="space-y-4" aria-label={`${token.name} artwork viewer`}>
      <div className="overflow-hidden rounded-[2.5rem] border border-ivory/10 bg-carbon p-4 shadow-[0_40px_140px_rgba(0,0,0,0.32)]">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-ink/45">
          {selectedMedia.type === "image" ? (
            <Image
              src={selectedMedia.src}
              alt={token.artwork.alt}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-contain p-4"
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
        </div>

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
          {previousHref ? (
            <ButtonLink href={previousHref} variant="secondary">
              Prev token
            </ButtonLink>
          ) : (
            <Button type="button" variant="secondary" disabled>
              Prev token
            </Button>
          )}
          {nextHref ? (
            <ButtonLink href={nextHref} variant="secondary">
              Next token
            </ButtonLink>
          ) : (
            <Button type="button" variant="secondary" disabled>
              Next token
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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
