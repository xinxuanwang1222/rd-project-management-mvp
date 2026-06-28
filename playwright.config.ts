import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "PATH=\"/Users/xinxuan/Library/pnpm/bin:$PATH\" /Users/xinxuan/Library/pnpm/bin/pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
