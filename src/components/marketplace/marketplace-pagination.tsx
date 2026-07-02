import { collectionMarketHref } from "@/lib/marketplace/routes";
import type { CollectionId, MarketplaceSearchParams } from "@/lib/marketplace/types";
import { cn } from "@/lib/utils";

export function MarketplacePagination({
  collectionId,
  search,
  page,
  totalPages,
}: {
  collectionId: CollectionId;
  search: MarketplaceSearchParams;
  page: number;
  totalPages: number;
}) {
  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PaginationLink
          href={collectionMarketHref({
            collectionId,
            search,
            page: Math.max(1, page - 1),
          })}
          disabled={page <= 1}
          label="Previous"
        />
        {pages.map((pageNumber, index) =>
          pageNumber === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-sm text-bone/60"
            >
              ...
            </span>
          ) : (
            <PaginationLink
              key={pageNumber}
              href={collectionMarketHref({
                collectionId,
                search,
                page: pageNumber,
              })}
              active={pageNumber === page}
              label={String(pageNumber)}
            />
          ),
        )}
        <PaginationLink
          href={collectionMarketHref({
            collectionId,
            search,
            page: Math.min(totalPages, page + 1),
          })}
          disabled={page >= totalPages}
          label="Next"
        />
      </div>
      <p className="text-sm text-bone/70">
        Page {page} of {totalPages}
      </p>
    </div>
  );
}

function PaginationLink({
  href,
  label,
  active = false,
  disabled = false,
}: {
  href: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-ivory/10 px-4 text-sm font-semibold text-bone/70 opacity-80"
      >
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
        active
          ? "bg-copper text-ink"
          : "border border-ivory/15 bg-ivory/[0.04] text-ivory hover:bg-ivory/[0.09]",
      )}
    >
      {label}
    </a>
  );
}

function buildPageNumbers(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}
