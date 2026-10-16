import { defineConfig } from "@playwright/test";
// Opt-in responsive audit (tests/browser-integration/responsive-audit.spec.ts):
//   SALON77_AUDIT=<label> PHASE2_PORT=32190 bunx playwright test --config .audit-playwright.config.ts
const port = Number(process.env.PHASE2_PORT ?? 32190),
  baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser-integration",
  testMatch: "responsive-audit.spec.ts",
  workers: 1,
  timeout: 900000,
  expect: { timeout: 15000 },
  use: { baseURL, actionTimeout: 20000 },
  // AUDIT_REUSE=1 audits an integration server that is already running.
  webServer: process.env.AUDIT_REUSE
    ? undefined
    : {
        command: "node --import tsx tests/fixtures/start-integration.ts",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180000,
        env: {
          PHASE2_PORT: String(port),
          FIXTURE_DB_PORT: process.env.FIXTURE_DB_PORT ?? "55579",
          FIXTURE_AUTH_PORT: process.env.FIXTURE_AUTH_PORT ?? "55580",
        },
      },
});
