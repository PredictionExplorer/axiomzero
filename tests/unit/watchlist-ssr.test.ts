// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readWatchlist } from "@/lib/watchlist";

describe("watchlist on the server", () => {
  it("reads as empty when no window exists", () => {
    expect(typeof window).toBe("undefined");
    expect(readWatchlist()).toEqual([]);
  });
});
