import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.PHASE2_PORT ?? 32178),
  baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser-integration",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node --import tsx tests/fixtures/start-integration.ts",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
