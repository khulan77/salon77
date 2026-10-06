import { defineConfig, devices } from "@playwright/test";
// Read-only form checks against an explicitly started configured development server.
export default defineConfig({
  testDir: "./tests/auth-smoke",
  use: {
    baseURL: process.env.SALON77_AUTH_TEST_URL ?? "http://127.0.0.1:32179",
    trace: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
