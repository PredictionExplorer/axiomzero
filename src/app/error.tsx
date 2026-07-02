"use client";

import { useEffect } from "react";

import { ButtonLink } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <p className="text-sm uppercase tracking-[0.34em] text-copper">
        Something went wrong
      </p>
      <h1 className="font-display mt-4 text-4xl font-semibold text-ivory">
        The marketplace hit an unexpected error
      </h1>
      <p className="mt-4 text-bone/78">
        Your wallet and on-chain contracts are unaffected. Try refreshing this
        view or return to the collection browser.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-full bg-copper px-5 text-sm font-semibold text-ink transition hover:bg-ember"
        >
          Try again
        </button>
        <ButtonLink href="/" variant="secondary">
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
