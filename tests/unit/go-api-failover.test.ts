import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  fetchGoApiJson,
  goApiFailoverUrl,
  GoApiError,
} from "@/lib/marketplace/go-api";
import {
  __resetServerRotation,
  ROTATION_PERIOD_MS,
} from "@/lib/server-rotation";

const RW1 = "https://api1.randomwalknft.example";
const RW2 = "https://api2.randomwalknft.example";
const CS1 = "https://a1.cosmicsignature.example";
const CS2 = "https://a2.cosmicsignature.example";

const schema = z.object({ status: z.number(), value: z.string() });

function jsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

/** A timestamp whose hourly slot picks the first of two servers. */
const firstSlot = () => {
  const hour = Math.floor(Date.now() / ROTATION_PERIOD_MS);
  return (hour - (hour % 2)) * ROTATION_PERIOD_MS;
};

beforeEach(() => {
  vi.stubEnv("RANDOM_WALK_API_URLS", `${RW1},${RW2}`);
  vi.stubEnv("COSMIC_SIGNATURE_API_URLS", `${CS1},${CS2}`);
  __resetServerRotation();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.useFakeTimers();
  vi.setSystemTime(firstSlot() + 1_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("goApiFailoverUrl", () => {
  it("rebases Random Walk URLs within the Random Walk group", () => {
    expect(goApiFailoverUrl(`${RW1}/api/randomwalk/tokens/info/5`)).toBe(
      `${RW2}/api/randomwalk/tokens/info/5`,
    );
  });

  it("rebases Cosmic Signature URLs within the Cosmic Signature group", () => {
    expect(goApiFailoverUrl(`${CS1}/api/cosmicgame/cst/info/5`)).toBe(
      `${CS2}/api/cosmicgame/cst/info/5`,
    );
  });

  it("returns null for URLs outside both groups", () => {
    expect(
      goApiFailoverUrl("https://randomwalknft-api.example/metadata/5"),
    ).toBeNull();
  });

  it("keeps /api/cosmicgame/ URLs inside the Cosmic Signature group when a host is shared", () => {
    const shared = "http://127.0.0.1:9";
    vi.stubEnv("RANDOM_WALK_API_URLS", `${shared},${RW2}`);
    vi.stubEnv("COSMIC_SIGNATURE_API_URLS", `${shared},${CS2}`);
    __resetServerRotation();

    expect(goApiFailoverUrl(`${shared}/api/cosmicgame/cst/info/5`)).toBe(
      `${CS2}/api/cosmicgame/cst/info/5`,
    );
  });
});

describe("fetchGoApiJson failover", () => {
  it("retries once on another server after a 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(502, undefined))
      .mockResolvedValueOnce(jsonResponse(200, { status: 1, value: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGoApiJson(`${RW1}/api/randomwalk/tokens/info/5`, schema),
    ).resolves.toEqual({ status: 1, value: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${RW2}/api/randomwalk/tokens/info/5`,
    );
  });

  it("retries once on another server after a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(200, { status: 1, value: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGoApiJson(`${CS1}/api/cosmicgame/cst/info/5`, schema),
    ).resolves.toEqual({ status: 1, value: "ok" });
    expect(fetchMock.mock.calls[1][0]).toBe(`${CS2}/api/cosmicgame/cst/info/5`);
  });

  it("does not retry 4xx data errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { status: 0, error: "not found" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGoApiJson(`${RW1}/api/randomwalk/tokens/info/999999`, schema),
    ).rejects.toBeInstanceOf(GoApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry schema mismatches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { unexpected: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGoApiJson(`${RW1}/api/randomwalk/tokens/info/5`, schema),
    ).rejects.toBeInstanceOf(z.ZodError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws the original error when the URL is outside the rotation groups", async () => {
    const failure = new TypeError("fetch failed");
    const fetchMock = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGoApiJson("https://randomwalknft-api.example/metadata/5", schema),
    ).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
