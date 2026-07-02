const ETH_USD_REVALIDATE_SECONDS = 300;

let cachedPrice: { value: number; fetchedAt: number } | undefined;

export function resetEthUsdPriceCacheForTests() {
  cachedPrice = undefined;
}

export async function getEthUsdPrice(): Promise<number | undefined> {
  const now = Date.now();

  if (
    cachedPrice &&
    now - cachedPrice.fetchedAt < ETH_USD_REVALIDATE_SECONDS * 1000
  ) {
    return cachedPrice.value;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: ETH_USD_REVALIDATE_SECONDS } },
    );

    if (!response.ok) {
      return cachedPrice?.value;
    }

    const payload = (await response.json()) as {
      ethereum?: { usd?: number };
    };
    const value = payload.ethereum?.usd;

    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      cachedPrice = { value, fetchedAt: now };
      return value;
    }
  } catch {
    return cachedPrice?.value;
  }

  return cachedPrice?.value;
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

export function formatEthWithUsd(eth: number, usdPerEth?: number) {
  if (!usdPerEth) {
    return undefined;
  }

  return formatUsd(eth * usdPerEth);
}
