import { describe, expect, it, vi } from "vitest";

const indexMocks = vi.hoisted(() => ({
  getCollectionTokenIds: vi.fn(),
}));

vi.mock("@/lib/marketplace/collection-index-live", () => indexMocks);

import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes static routes and token detail pages", async () => {
    indexMocks.getCollectionTokenIds
      .mockResolvedValueOnce([1, 2])
      .mockResolvedValueOnce([0]);

    const entries = await sitemap();

    expect(entries.some((entry) => entry.url.endsWith("axiomzero.market"))).toBe(
      true,
    );
    expect(entries.some((entry) => entry.url.includes("/random-walk"))).toBe(
      true,
    );
    expect(
      entries.some((entry) => entry.url.includes("/token/random-walk/1")),
    ).toBe(true);
    expect(
      entries.some((entry) => entry.url.includes("/token/cosmic-signature/0")),
    ).toBe(true);
  });
});
