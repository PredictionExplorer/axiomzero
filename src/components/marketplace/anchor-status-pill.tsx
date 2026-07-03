import { cn } from "@/lib/utils";

export function anchorStatusLabel(anchored: boolean, inVault = false) {
  if (!anchored) {
    return "Never anchored";
  }

  return inVault ? "Anchored now" : "Anchor used";
}

/**
 * Anchor status badge. Anchoring on cosmicsignature.com is a one-time action
 * per token, so never-anchored tokens keep that option open and often carry a
 * premium. Renders nothing when the on-chain status is unknown.
 */
export function AnchorStatusPill({
  anchored,
  inVault = false,
  className,
}: {
  anchored?: boolean;
  /** Whether the token currently sits in the anchoring vault. */
  inVault?: boolean;
  className?: string;
}) {
  if (anchored === undefined) {
    return null;
  }

  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur",
        anchored
          ? "border-ivory/15 bg-ink/72 text-bone/80"
          : "border-chartreuse/25 bg-chartreuse/12 text-chartreuse",
        className,
      )}
    >
      {anchorStatusLabel(anchored, inVault)}
      <span className="sr-only">
        {anchored
          ? inVault
            ? ", currently held in the cosmicsignature.com anchoring vault; its one-time anchor is used"
            : ", the one-time cosmicsignature.com anchor has already been used"
          : ", the one-time cosmicsignature.com anchor is still available"}
      </span>
    </span>
  );
}
