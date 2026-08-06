import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arbitrum } from "viem/chains";

import { __resetServerRotation } from "@/lib/server-rotation";
import { getArbitrumRpcTransport } from "@/lib/web3/arbitrum-transport";

beforeEach(() => {
  __resetServerRotation();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getArbitrumRpcTransport", () => {
  it("uses a plain http transport for a single configured server", () => {
    const transport = getArbitrumRpcTransport({ timeout: 5_000 });
    const instance = transport({ chain: arbitrum });

    expect(instance.config.type).toBe("http");
    expect((instance.value as { url?: string } | undefined)?.url).toBe(
      "https://arb1.arbitrum.io/rpc",
    );
  });

  it("wraps multiple servers in a rotation-ordered fallback transport", () => {
    vi.stubEnv(
      "ARBITRUM_RPC_URLS",
      "https://rpc1.example.com,https://rpc2.example.com",
    );
    __resetServerRotation();

    const transport = getArbitrumRpcTransport({ timeout: 5_000 });
    const instance = transport({ chain: arbitrum });

    expect(instance.config.type).toBe("fallback");
    const urls = (
      instance.value as unknown as {
        transports: Array<{ value?: { url?: string } }>;
      }
    ).transports.map((entry) => entry.value?.url);
    expect(urls).toHaveLength(2);
    expect(new Set(urls)).toEqual(
      new Set(["https://rpc1.example.com", "https://rpc2.example.com"]),
    );
  });
});
