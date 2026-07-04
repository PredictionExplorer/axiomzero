export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

const ETH_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** Narrows a string to a well-formed 0x address, or undefined. */
export function coerceAddress(
  value: string | undefined,
): `0x${string}` | undefined {
  if (value && ETH_ADDRESS_PATTERN.test(value)) {
    return value as `0x${string}`;
  }

  return undefined;
}

export function isZeroAddress(value: string | undefined) {
  return value?.toLowerCase() === ZERO_ADDRESS;
}

/**
 * Address of an event participant. The Go backend fills absent participants
 * with the zero address, which means "nobody" rather than a real account.
 */
export function participantAddress(
  value: string | undefined,
): `0x${string}` | undefined {
  const address = coerceAddress(value);

  return address && !isZeroAddress(address) ? address : undefined;
}
