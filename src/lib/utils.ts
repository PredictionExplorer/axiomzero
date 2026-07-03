import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEth(value: number) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 4,
  })} ETH`;
}

export function formatTokenId(tokenId: number) {
  return `#${String(tokenId).padStart(6, "0")}`;
}

export function shortenAddress(address: string, visible = 4) {
  if (address.length <= visible * 2 + 5) {
    return address;
  }

  return `${address.slice(0, visible + 2)}...${address.slice(-visible)}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Short relative time for activity feeds, e.g. "just now", "5m ago",
 * "3h ago", "2d ago", "4mo ago", "1y ago". Returns undefined for invalid
 * or future timestamps.
 */
export function formatRelativeTime(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();

  if (!Number.isFinite(then) || then > now) {
    return undefined;
  }

  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 60) {
    return `${days}d ago`;
  }

  if (days < 365) {
    return `${Math.floor(days / 30)}mo ago`;
  }

  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Compares a listing price against the collection floor, e.g. "At floor",
 * "+12% vs floor", "-8% vs floor". Returns undefined when no comparison is
 * possible.
 */
export function formatFloorDelta(priceEth: number, floorEth?: number) {
  if (
    floorEth === undefined ||
    !Number.isFinite(priceEth) ||
    !Number.isFinite(floorEth) ||
    floorEth <= 0
  ) {
    return undefined;
  }

  const delta = ((priceEth - floorEth) / floorEth) * 100;

  if (Math.abs(delta) < 0.5) {
    return "At floor";
  }

  // Extreme premiums read better as a multiplier than a huge percentage.
  if (delta >= 400) {
    const ratio = priceEth / floorEth;

    return `${ratio < 10 ? Math.round(ratio * 10) / 10 : Math.round(ratio)}x floor`;
  }

  const magnitude = Math.abs(delta);
  const rounded =
    magnitude < 10 ? Math.round(magnitude * 10) / 10 : Math.round(magnitude);

  return `${delta > 0 ? "+" : "-"}${rounded}% vs floor`;
}
