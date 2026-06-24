import type { MarketplaceStats } from "@/lib/marketplace/types";
import { formatEth } from "@/lib/utils";

const statLabel = (value: number | undefined) =>
  value === undefined ? "N/A" : formatEth(value);

export function MarketplaceStatsGrid({ stats }: { stats: MarketplaceStats }) {
  const items = [
    { label: "Platform fee", value: "0%" },
    { label: "Founder privilege", value: "0" },
    { label: "Visible orders", value: stats.totalOffers.toString() },
    { label: "Lowest ask", value: statLabel(stats.lowestPrice) },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[1.6rem] border border-ivory/10 bg-ivory/[0.04] p-5"
        >
          <p className="text-xs uppercase tracking-[0.24em] text-bone/75">
            {item.label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-ivory">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
