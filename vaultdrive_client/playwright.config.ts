import { defineConfig } from "@playwright/test";

const configuredBaseURL = process.env.ABRN_E2E_BASE_URL ?? "http://127.0.0.1:8090/abrn";
const baseURL = configuredBaseURL.endsWith("/") ? configuredBaseURL : `${configuredBaseURL}/`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  expect: {
    timeout: 15000,
  },
  timeout: 120000,
  webServer: {
    command: "cd .. && PORT=8090 go run .",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
