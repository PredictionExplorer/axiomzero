import { describe, expect, it } from "vitest";

import {
  isPositiveEthAmount,
  sameAddress,
} from "@/lib/marketplace/trading-actions";

describe("trading action helpers", () => {
  it("compares wallet addresses case-insensitively", () => {
    expect(
      sameAddress(
        "0x00000000000000000000000000000000000000aA",
        "0x00000000000000000000000000000000000000Aa",
      ),
    ).toBe(true);
    expect(
      sameAddress(
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
      ),
    ).toBe(false);
    expect(sameAddress(undefined, "0x0000000000000000000000000000000000000002")).toBe(
      false,
    );
  });

  it("accepts only positive ETH amounts", () => {
    expect(isPositiveEthAmount("0.001")).toBe(true);
    expect(isPositiveEthAmount(" 1 ")).toBe(true);
    expect(isPositiveEthAmount("0")).toBe(false);
    expect(isPositiveEthAmount("-1")).toBe(false);
    expect(isPositiveEthAmount("not-eth")).toBe(false);
  });
});
