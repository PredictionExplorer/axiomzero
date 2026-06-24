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
