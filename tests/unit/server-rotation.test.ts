import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import {
  FAILURE_COOLDOWN_MS,
  ROTATION_PERIOD_MS,
  __resetServerRotation,
  failoverUrl,
  getArbitrumRpcUrls,
  getArbitrumRpcUrlsInRotationOrder,
  getCosmicSignatureApiBase,
  getCosmicSignatureApiUrls,
  getRandomWalkApiBase,
  getRandomWalkApiUrls,
  markServerDown,
  parseUrlList,
  pickServer,
  rebaseUrl,
} from "@/lib/server-rotation";

const A = "https://a1.example.com";
const B = "https://a2.example.com";
const C = "https://a3.example.com";

/** A timestamp whose hourly slot is 0 for a list of `n` servers. */
const slotStart = (n: number) => {
  const hour = Math.floor(Date.now() / ROTATION_PERIOD_MS);
  return (hour - (hour % n)) * ROTATION_PERIOD_MS;
};

let warnSpy: MockInstance;
let logSpy: MockInstance;

beforeEach(() => {
  __resetServerRotation();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  logSpy.mockRestore();
  vi.unstubAllEnvs();
});

describe("parseUrlList", () => {
  it("uses the first candidate that yields entries, trimming slashes", () => {
    expect(parseUrlList(` ${A}/ , ${B}`, "https://ignored.example.com")).toEqual(
      [A, B],
    );
  });

  it("falls through empty candidates to later ones", () => {
    expect(parseUrlList(undefined, "", " , ", `${A}/`)).toEqual([A]);
  });

  it("returns [] when nothing is configured", () => {
    expect(parseUrlList(undefined, "")).toEqual([]);
  });
});

describe("env URL lists", () => {
  it("defaults to the hardcoded single-server lists", () => {
    expect(getArbitrumRpcUrls()).toEqual(["https://arb1.arbitrum.io/rpc"]);
    expect(getRandomWalkApiUrls()).toEqual([
      "https://api.randomwalknft.com:1443",
    ]);
    expect(getCosmicSignatureApiUrls()).toEqual([
      "https://nfts.cosmicsignature.com",
    ]);
  });

  it("prefers the plural *_URLS lists", () => {
    vi.stubEnv("ARBITRUM_RPC_URLS", `${A},${B}`);
    vi.stubEnv("RANDOM_WALK_API_URLS", `${A},${B}`);
    vi.stubEnv("COSMIC_SIGNATURE_API_URLS", `${B},${C}`);
    __resetServerRotation();

    expect(getArbitrumRpcUrls()).toEqual([A, B]);
    expect(getRandomWalkApiUrls()).toEqual([A, B]);
    expect(getCosmicSignatureApiUrls()).toEqual([B, C]);
  });

  it("falls back to the singular vars as one-element lists", () => {
    vi.stubEnv("NEXT_PUBLIC_ARBITRUM_RPC_URL", `${C}/`);
    vi.stubEnv("RANDOM_WALK_API_URL", A);
    vi.stubEnv("NEXT_PUBLIC_COSMIC_SIGNATURE_API_URL", B);
    __resetServerRotation();

    expect(getArbitrumRpcUrls()).toEqual([C]);
    expect(getRandomWalkApiUrls()).toEqual([A]);
    expect(getCosmicSignatureApiUrls()).toEqual([B]);
  });

  it("caches the resolved list until reset", () => {
    expect(getRandomWalkApiUrls()).toEqual([
      "https://api.randomwalknft.com:1443",
    ]);
    vi.stubEnv("RANDOM_WALK_API_URLS", `${A},${B}`);
    expect(getRandomWalkApiUrls()).toEqual([
      "https://api.randomwalknft.com:1443",
    ]);
    __resetServerRotation();
    expect(getRandomWalkApiUrls()).toEqual([A, B]);
  });
});

describe("pickServer", () => {
  it("alternates servers by clock hour", () => {
    const t0 = slotStart(2);
    expect(pickServer([A, B], t0)).toBe(A);
    expect(pickServer([A, B], t0 + ROTATION_PERIOD_MS)).toBe(B);
    expect(pickServer([A, B], t0 + 2 * ROTATION_PERIOD_MS)).toBe(A);
  });

  it("is sticky within the hour", () => {
    const t0 = slotStart(2);
    expect(pickServer([A, B], t0 + 1)).toBe(A);
    expect(pickServer([A, B], t0 + ROTATION_PERIOD_MS - 1)).toBe(A);
  });

  it("skips a server that was marked down", () => {
    const t0 = slotStart(2);
    markServerDown(A, t0);
    expect(pickServer([A, B], t0 + 1)).toBe(B);
  });

  it("returns the downed server again after the cooldown", () => {
    const t0 = slotStart(2);
    markServerDown(A, t0);
    expect(pickServer([A, B], t0 + FAILURE_COOLDOWN_MS + 1)).toBe(A);
  });

  it("walks the whole list when several servers are down", () => {
    const t0 = slotStart(3);
    markServerDown(A, t0);
    markServerDown(B, t0);
    expect(pickServer([A, B, C], t0 + 1)).toBe(C);
  });

  it("falls back to the hourly pick (and logs) when all servers are down", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const t0 = slotStart(2);
    markServerDown(A, t0);
    markServerDown(B, t0);
    expect(pickServer([A, B], t0 + 1)).toBe(A);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns "" for an empty list', () => {
    expect(pickServer([], Date.now())).toBe("");
  });

  it("announces selection changes once per label", () => {
    const t0 = slotStart(2);
    pickServer([A, B], t0, "Test API");
    pickServer([A, B], t0, "Test API");
    expect(
      logSpy.mock.calls.filter(([message]) =>
        String(message).includes("Test API"),
      ),
    ).toHaveLength(1);
  });
});

describe("markServerDown", () => {
  it("normalizes trailing slashes", () => {
    const t0 = slotStart(2);
    markServerDown(`${A}///`, t0);
    expect(pickServer([A, B], t0 + 1)).toBe(B);
  });

  it("ignores empty URLs", () => {
    markServerDown("");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("rotation-aware base getters", () => {
  it("returns the current pick for both API groups", () => {
    expect(getRandomWalkApiBase()).toBe("https://api.randomwalknft.com:1443");
    expect(getCosmicSignatureApiBase()).toBe(
      "https://nfts.cosmicsignature.com",
    );
  });

  it("picks from the configured plural lists", () => {
    vi.stubEnv("RANDOM_WALK_API_URLS", `${A},${B}`);
    __resetServerRotation();
    expect([A, B]).toContain(getRandomWalkApiBase());
  });
});

describe("getArbitrumRpcUrlsInRotationOrder", () => {
  it("returns the single default URL when nothing is configured", () => {
    expect(getArbitrumRpcUrlsInRotationOrder()).toEqual([
      "https://arb1.arbitrum.io/rpc",
    ]);
  });

  it("puts the hourly pick first and keeps all servers", () => {
    vi.stubEnv("ARBITRUM_RPC_URLS", `${A},${B}`);
    __resetServerRotation();
    const t0 = slotStart(2);
    expect(getArbitrumRpcUrlsInRotationOrder(t0)).toEqual([A, B]);
    expect(getArbitrumRpcUrlsInRotationOrder(t0 + ROTATION_PERIOD_MS)).toEqual([
      B,
      A,
    ]);
  });
});

describe("rebaseUrl", () => {
  it("moves a URL from the failed base onto the current pick", () => {
    const t0 = slotStart(2);
    markServerDown(A, t0);
    expect(rebaseUrl(`${A}/api/randomwalk/tokens/info/5`, [A, B], t0 + 1)).toBe(
      `${B}/api/randomwalk/tokens/info/5`,
    );
  });

  it("returns null for URLs outside the configured bases", () => {
    expect(rebaseUrl("https://other.example.com/x", [A, B], Date.now())).toBe(
      null,
    );
  });

  it("returns null when no alternative server is available", () => {
    const t0 = slotStart(2);
    expect(rebaseUrl(`${A}/statistics`, [A], t0)).toBeNull();
  });
});

describe("failoverUrl", () => {
  it("marks the failed base down and rebuilds against the next server", () => {
    const t0 = slotStart(2);
    expect(failoverUrl(`${A}/api/x`, [A, B], t0)).toBe(`${B}/api/x`);
    expect(pickServer([A, B], t0 + 1)).toBe(B);
  });

  it("returns null (and marks nothing) for unmatched URLs", () => {
    expect(failoverUrl("https://other.example.com/x", [A, B])).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns null when there is no alternative server", () => {
    const t0 = slotStart(1);
    expect(failoverUrl(`${A}/api/x`, [A], t0)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
