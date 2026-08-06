import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readCosmicSignatureOwnedTokenIds,
  readRandomWalkOwnedTokenIds,
} from "@/lib/marketplace/owned-tokens";
import {
  __resetServerRotation,
  ROTATION_PERIOD_MS,
} from "@/lib/server-rotation";

const RW1 = "https://api1.randomwalknft.example";
const RW2 = "https://api2.randomwalknft.example";
const CS1 = "https://a1.cosmicsignature.example";
const CS2 = "https://a2.cosmicsignature.example";

const OWNER = "0x0000000000000000000000000000000000000001" as const;

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

describe("readRandomWalkOwnedTokenIds", () => {
  it("fetches from the rotation pick and returns sorted unique ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        status: 1,
        UserTokens: [
          { TokenId: 7 },
          { TokenId: 3 },
          { TokenId: 7 },
          { TokenId: "bogus" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readRandomWalkOwnedTokenIds(OWNER)).resolves.toEqual([3, 7]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${RW1}/api/randomwalk/tokens/by_user/${OWNER}`,
      { headers: { Accept: "application/json" } },
    );
  });

  it("fails over to the next server on a network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 1, UserTokens: [{ TokenId: 5 }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readRandomWalkOwnedTokenIds(OWNER)).resolves.toEqual([5]);
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${RW2}/api/randomwalk/tokens/by_user/${OWNER}`,
    );
  });

  it("rethrows a network error when no alternative server exists", async () => {
    vi.stubEnv("RANDOM_WALK_API_URLS", "");
    vi.stubEnv("RANDOM_WALK_API_URL", RW1);
    __resetServerRotation();
    const failure = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));

    await expect(readRandomWalkOwnedTokenIds(OWNER)).rejects.toBe(failure);
  });

  it("fails over to the next server on a 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, undefined))
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 1, UserTokens: [{ TokenId: 9 }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readRandomWalkOwnedTokenIds(OWNER)).resolves.toEqual([9]);
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${RW2}/api/randomwalk/tokens/by_user/${OWNER}`,
    );
  });

  it("reports the 5xx when no alternative server exists", async () => {
    vi.stubEnv("RANDOM_WALK_API_URLS", "");
    vi.stubEnv("RANDOM_WALK_API_URL", RW1);
    __resetServerRotation();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(500, undefined)),
    );

    await expect(readRandomWalkOwnedTokenIds(OWNER)).rejects.toThrow(
      "Random Walk owned-token lookup returned 500.",
    );
  });

  it("reports non-OK statuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, undefined)),
    );

    await expect(readRandomWalkOwnedTokenIds(OWNER)).rejects.toThrow(
      "Random Walk owned-token lookup returned 404.",
    );
  });

  it("reports envelope failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { status: 0 })),
    );

    await expect(readRandomWalkOwnedTokenIds(OWNER)).rejects.toThrow(
      "Random Walk owned-token lookup failed.",
    );
  });

  it("treats a null UserTokens list as empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse(200, { status: 1, UserTokens: null })),
    );

    await expect(readRandomWalkOwnedTokenIds(OWNER)).resolves.toEqual([]);
  });
});

describe("readCosmicSignatureOwnedTokenIds", () => {
  it("fetches from the Cosmic Signature rotation pick", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        status: 1,
        UserTokens: [{ TokenId: 2 }, { TokenId: 1 }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readCosmicSignatureOwnedTokenIds(OWNER)).resolves.toEqual([
      1, 2,
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${CS1}/api/cosmicgame/cst/list/by_user/${OWNER}/0/1000`,
      { headers: { Accept: "application/json" } },
    );
  });
});
