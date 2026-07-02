import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatEthWithUsd,
  formatUsd,
  getEthUsdPrice,
  resetEthUsdPriceCacheForTests,
} from "@/lib/pricing/eth-usd";

describe("eth usd pricing", () => {
  afterEach(() => {
    resetEthUsdPriceCacheForTests();
    vi.unstubAllGlobals();
  });

  it("formats usd values", () => {
    expect(formatUsd(12.56)).toMatch(/\$12\.56/);
    expect(formatEthWithUsd(1.25, 2000)).toBe("$2,500");
  });

  it("fetches and caches eth usd price", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ethereum: { usd: 2500 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getEthUsdPrice()).resolves.toBe(2500);
    await expect(getEthUsdPrice()).resolves.toBe(2500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when price lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(getEthUsdPrice()).resolves.toBeUndefined();
  });
});
