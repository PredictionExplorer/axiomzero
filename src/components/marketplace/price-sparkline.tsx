import type { TokenHistoryViewRecord } from "@/lib/marketplace/token-detail";

export function PriceSparkline({
  records,
}: {
  records: TokenHistoryViewRecord[];
}) {
  const prices = records
    .map((record) => {
      if (!record.price) {
        return undefined;
      }

      const numeric = Number.parseFloat(record.price.replace(/[^\d.]/g, ""));
      return Number.isFinite(numeric) ? numeric : undefined;
    })
    .filter((value): value is number => value !== undefined);

  if (prices.length < 2) {
    return null;
  }

  const width = 280;
  const height = 72;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices
    .map((price, index) => {
      const x = (index / (prices.length - 1)) * width;
      const y = height - ((price - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-6 rounded-2xl border border-ivory/10 bg-ink/45 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-bone/65">
        Sale price trend
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-20 w-full text-chartreuse"
        role="img"
        aria-label="Sale price trend sparkline"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
        />
      </svg>
    </div>
  );
}
