import { BRAND_NAME, BRAND_PRINCIPLES, FOUNDATION_STATEMENT } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-ivory/10 bg-carbon px-5 py-10 text-bone/78 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.34em] text-copper">
            {BRAND_NAME}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6">
            {FOUNDATION_STATEMENT} No marketplace fees, no allowlists, no
            insider allocations, and no founder privilege.
          </p>
        </div>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {BRAND_PRINCIPLES.map((principle) => (
            <li key={principle} className="rounded-full border border-ivory/10 px-4 py-2">
              {principle}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
