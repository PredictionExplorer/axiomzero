import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      // Ratcheted to just below the achieved coverage so it can only go up.
      // The remaining uncovered lines are defensive wallet-state guards that
      // sit behind disabled buttons and module-level env fallbacks.
      thresholds: {
        statements: 98,
        branches: 94,
        functions: 99,
        lines: 98,
      },
    },
  },
});
