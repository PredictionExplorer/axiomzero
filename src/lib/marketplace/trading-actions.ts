import { parseEther } from "viem";

export function sameAddress(left?: `0x${string}`, right?: `0x${string}`) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export function isPositiveEthAmount(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  try {
    return parseEther(trimmed) > 0n;
  } catch {
    return false;
  }
}
