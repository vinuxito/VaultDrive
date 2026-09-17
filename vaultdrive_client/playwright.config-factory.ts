import { defineConfig } from "@playwright/test";

function privateURL(raw: string | undefined, name: string): URL {
  if (!raw?.trim()) throw new Error(`${name} must explicitly select a prepared private test server.`);
  const url = new URL(raw.trim());
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname)
    || !url.port || ["80", "443", "8082"].includes(url.port)
    || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an explicit loopback HTTP URL on a private port; production and credential-bearing URLs are forbidden.`);
  }
  return url;
}

export function createPlaywrightConfig(env: NodeJS.ProcessEnv = process.env) {
  const frontend = privateURL(env.E2E_BASE_URL, "E2E_BASE_URL");
  const api = privateURL(env.E2E_API_BASE_URL, "E2E_API_BASE_URL");
  if (frontend.origin !== api.origin || api.pathname.replace(/\/$/, "") !== "/api") {
    throw new Error("The private frontend and /api must share an origin.");
  }
  const baseURL = frontend.href.endsWith("/") ? frontend.href : `${frontend.href}/`;
  return defineConfig({
    testDir: "./e2e",
    outputDir: env.E2E_OUTPUT_DIR ?? "test-results",
    fullyParallel: false,
    forbidOnly: !!env.CI,
    retries: env.CI ? 2 : 0,
    workers: env.CI ? 1 : undefined,
    reporter: env.CI
      ? [["github"], ["html", { open: "never", outputFolder: env.E2E_REPORT_DIR ?? "playwright-report" }]]
      : [["list"], ["html", { open: "never", outputFolder: env.E2E_REPORT_DIR ?? "playwright-report" }]],
    projects: [
      {
        name: "Desktop Chrome",
        use: {
          viewport: { width: 1280, height: 720 },
        },
        testIgnore: "**/mobile/**",
      },
      {
        name: "Mobile Chrome",
        use: {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        },
        testMatch: "**/mobile/**",
      },
    ],
    use: {
      baseURL,
      launchOptions: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : undefined,
      trace: "on-first-retry",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
    },
    expect: {
      timeout: 15000,
    },
    timeout: 120000,
    // The caller prepares a private server explicitly; this runner never builds,
    // starts a backend, migrates a database, or reads production .env files.
    webServer: undefined,
  });
}
