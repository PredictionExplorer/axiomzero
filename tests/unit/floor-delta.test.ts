import { describe, expect, it } from "vitest";

import { formatFloorDelta } from "@/lib/utils";

describe("formatFloorDelta", () => {
  it("returns undefined when no comparison is possible", () => {
    expect(formatFloorDelta(1, undefined)).toBeUndefined();
    expect(formatFloorDelta(1, 0)).toBeUndefined();
    expect(formatFloorDelta(Number.NaN, 1)).toBeUndefined();
  });

  it("treats prices within half a percent as at floor", () => {
    expect(formatFloorDelta(1, 1)).toBe("At floor");
    expect(formatFloorDelta(1.004, 1)).toBe("At floor");
  });

  it("formats small deltas with one decimal and large ones as integers", () => {
    expect(formatFloorDelta(1.08, 1)).toBe("+8% vs floor");
    expect(formatFloorDelta(1.085, 1)).toBe("+8.5% vs floor");
    expect(formatFloorDelta(1.5, 1)).toBe("+50% vs floor");
    expect(formatFloorDelta(0.9, 1)).toBe("-10% vs floor");
  });

  it("switches to a multiplier for extreme premiums", () => {
    expect(formatFloorDelta(5.5, 1)).toBe("5.5x floor");
    expect(formatFloorDelta(300, 0.1)).toBe("3000x floor");
    expect(formatFloorDelta(4.9, 1)).toBe("+390% vs floor");
  });
});
