import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/utils";

const NOW = Date.parse("2026-07-02T12:00:00.000Z");

function agoIso(ms: number) {
  return new Date(NOW - ms).toISOString();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it("rejects invalid and future timestamps", () => {
    expect(formatRelativeTime("not-a-date", NOW)).toBeUndefined();
    expect(formatRelativeTime(agoIso(-HOUR), NOW)).toBeUndefined();
  });

  it("covers the full range of units", () => {
    expect(formatRelativeTime(agoIso(30_000), NOW)).toBe("just now");
    expect(formatRelativeTime(agoIso(5 * MINUTE), NOW)).toBe("5m ago");
    expect(formatRelativeTime(agoIso(3 * HOUR), NOW)).toBe("3h ago");
    expect(formatRelativeTime(agoIso(2 * DAY), NOW)).toBe("2d ago");
    expect(formatRelativeTime(agoIso(59 * DAY), NOW)).toBe("59d ago");
    expect(formatRelativeTime(agoIso(90 * DAY), NOW)).toBe("3mo ago");
    expect(formatRelativeTime(agoIso(364 * DAY), NOW)).toBe("12mo ago");
    expect(formatRelativeTime(agoIso(800 * DAY), NOW)).toBe("2y ago");
  });

  it("treats unit boundaries consistently", () => {
    expect(formatRelativeTime(agoIso(MINUTE), NOW)).toBe("1m ago");
    expect(formatRelativeTime(agoIso(HOUR), NOW)).toBe("1h ago");
    expect(formatRelativeTime(agoIso(DAY), NOW)).toBe("1d ago");
    expect(formatRelativeTime(agoIso(365 * DAY), NOW)).toBe("1y ago");
  });
});
