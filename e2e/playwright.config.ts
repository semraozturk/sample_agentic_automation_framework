import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const paperTrail = path.join(__dirname, "..", "paper-trail");
const isCi = !!process.env.CI;

// One-time-use test data is reserved per run, and the reservation size depends
// on the worker count. When PLAYWRIGHT_WORKERS is set, data-check.mjs and this
// config read the same number; otherwise Playwright picks its own default.
const workers = process.env.PLAYWRIGHT_WORKERS
  ? Number(process.env.PLAYWRIGHT_WORKERS)
  : undefined;

export default defineConfig({
  testDir: "./src/specs",
  fullyParallel: false,
  workers,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["json", { outputFile: "test-results/results.json" }],
        ["junit", { outputFile: "test-results/junit.xml" }],
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["json", { outputFile: "test-results/results.json" }],
      ],
  use: {
    baseURL: "http://localhost:3000",
    trace: isCi ? "retain-on-failure" : "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "python3 -m http.server 3000",
    cwd: paperTrail,
    url: "http://localhost:3000",
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
