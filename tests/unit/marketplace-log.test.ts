import { afterEach, describe, expect, it, vi } from "vitest";

import { logMarketplaceDegradation } from "@/lib/marketplace/log";

describe("logMarketplaceDegradation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("stays silent during unit tests", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logMarketplaceDegradation("token detail", new Error("api down"));

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns with the degradation context outside of tests", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logMarketplaceDegradation("token detail", new Error("api down"));
    logMarketplaceDegradation("offer scan", "string failure");

    expect(warn).toHaveBeenCalledWith("[marketplace] token detail: api down");
    expect(warn).toHaveBeenCalledWith(
      "[marketplace] offer scan: string failure",
    );
  });
});
