import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { collectionPath } from "@/lib/marketplace/routes";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <p className="text-sm uppercase tracking-[0.34em] text-copper">404</p>
      <h1 className="font-display mt-4 text-5xl font-semibold text-ivory">
        This page is not in the collection
      </h1>
      <p className="mt-4 text-bone/78">
        The token or route you requested does not exist on Axiom Zero. Browse
        live listings or return to the home market.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Back home</ButtonLink>
        <ButtonLink href={collectionPath("random-walk")} variant="secondary">
          Random Walk
        </ButtonLink>
        <Link
          href={collectionPath("cosmic-signature")}
          className="inline-flex h-11 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.04] px-5 text-sm font-semibold text-ivory transition hover:bg-ivory/[0.09]"
        >
          Cosmic Signature
        </Link>
      </div>
    </div>
  );
}
