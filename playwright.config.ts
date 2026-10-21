import { defineConfig } from "@playwright/test";
process.env.FIREBASE_PROJECT_ID = "demo-skillspring";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8101";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9101";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3011",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "node scripts/local.mjs dev",
    url: "http://localhost:3011",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
