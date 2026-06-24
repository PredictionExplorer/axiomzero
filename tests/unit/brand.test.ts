import { describe, expect, it } from "vitest";

import {
  BRAND_DESCRIPTION,
  BRAND_PRINCIPLES,
  FOUNDATION_STATEMENT,
  ZERO_PROMISES,
} from "@/lib/brand";

describe("brand messaging", () => {
  it("states the zero-privilege commitments", () => {
    expect(BRAND_PRINCIPLES).toContain("0% marketplace fees");
    expect(BRAND_PRINCIPLES).toContain("Zero founder privilege");
    expect(ZERO_PROMISES.map((promise) => promise.label)).toEqual([
      "0% marketplace fees",
      "Zero allowlists",
      "Zero insider allocations",
      "Zero reserved founder mints",
      "Zero preferential access",
      "Zero creator or founder privilege",
    ]);
  });

  it("frames the marketplace around generative foundations", () => {
    expect(BRAND_DESCRIPTION).toMatch(/mathematics, code, algorithms/i);
    expect(FOUNDATION_STATEMENT).toMatch(/foundational rules/i);
  });
});
