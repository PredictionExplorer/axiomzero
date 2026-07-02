"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";

type ShareLink = {
  label: string;
  value: string;
};

export function TokenShareActions({
  links,
  detailHref,
  title,
}: {
  links: ShareLink[];
  detailHref: string;
  title: string;
}) {
  const [status, setStatus] = useState<string>();
  const encodedUrl = encodeURIComponent(detailHref);
  const encodedTitle = encodeURIComponent(title);

  async function copyLink(link: ShareLink) {
    if (!navigator.clipboard) {
      setStatus("Clipboard access is unavailable in this browser.");
      return;
    }

    await navigator.clipboard.writeText(link.value);
    setStatus(`${link.label} copied.`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {links.map((link) => (
          <Button
            key={link.label}
            type="button"
            variant="secondary"
            onClick={() => void copyLink(link)}
          >
            Copy {link.label}
          </Button>
        ))}
        <ButtonLink
          href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          variant="outline"
        >
          Share on X
        </ButtonLink>
        <ButtonLink
          href={`https://warpcast.com/~/compose?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          variant="outline"
        >
          Share on Warpcast
        </ButtonLink>
      </div>
      <p className="min-h-5 text-sm text-bone/70" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
