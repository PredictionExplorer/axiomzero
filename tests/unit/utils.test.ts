import { describe, expect, it } from "vitest";

import { cn, formatDate, formatEth, formatTokenId, shortenAddress } from "@/lib/utils";

describe("utils", () => {
  it("formats ETH amounts for marketplace display", () => {
    expect(formatEth(0.1)).toBe("0.1000 ETH");
    expect(formatEth(77)).toBe("77.00 ETH");
  });

  it("formats token ids with six digits", () => {
    expect(formatTokenId(38)).toBe("#000038");
  });

  it("shortens wallet addresses", () => {
    expect(
      shortenAddress("0x0000000000000000000000000000000000000038"),
    ).toBe("0x0000...0038");
    expect(shortenAddress("0x1234")).toBe("0x1234");
  });

  it("merges Tailwind classes", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toContain("px-4");
    expect(cn("px-2", false && "hidden", "px-4")).not.toContain("px-2");
  });

  it("formats dates", () => {
    expect(formatDate("2026-06-24T15:42:00.000Z")).toContain("Jun");
  });
});
