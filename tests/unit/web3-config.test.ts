import { afterEach, describe, expect, it, vi } from "vitest";

const getDefaultConfigMock = vi.hoisted(() =>
  vi.fn((config: unknown) => ({ config })),
);

vi.mock("@rainbow-me/rainbowkit", () => ({
  getDefaultConfig: getDefaultConfigMock,
}));

const originalEnv = { ...process.env };

async function importConfigWithEnv(
  env: Partial<NodeJS.ProcessEnv>,
): Promise<typeof import("@/lib/web3/config")> {
  vi.resetModules();
  getDefaultConfigMock.mockClear();
  process.env = { ...originalEnv, ...env };

  if (!("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" in env)) {
    delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  }
  if (!("VERCEL_ENV" in env)) {
    delete process.env.VERCEL_ENV;
  }

  return import("@/lib/web3/config");
}

describe("web3 config", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    getDefaultConfigMock.mockClear();
  });

  it("uses an internal placeholder only to keep Vercel production builds SSR-safe", async () => {
    const config = await importConfigWithEnv({ VERCEL_ENV: "production" });

    expect(config.isWalletConnectConfigured).toBe(false);
    expect(config.walletConnectProjectId).toBeUndefined();
    expect(getDefaultConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: "Axiom Zero",
        projectId: "00000000000000000000000000000000",
        ssr: true,
      }),
    );
  });

  it("marks wallet connection available when a project ID is configured", async () => {
    const config = await importConfigWithEnv({
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "configured-project",
      VERCEL_ENV: "production",
    });

    expect(config.isWalletConnectConfigured).toBe(true);
    expect(config.walletConnectProjectId).toBe("configured-project");
    expect(getDefaultConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "configured-project",
      }),
    );
  });

  it("treats blank project IDs as missing", async () => {
    const config = await importConfigWithEnv({
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "   ",
    });

    expect(config.isWalletConnectConfigured).toBe(false);
    expect(config.walletConnectProjectId).toBeUndefined();
  });
});
