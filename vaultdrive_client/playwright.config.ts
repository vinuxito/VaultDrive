import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";

// Load test environment variables if .env.test exists, otherwise fall back to .env
if (fs.existsSync(".env.test")) {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

export function createPlaywrightConfig(env: NodeJS.ProcessEnv = process.env) {
  const explicitBaseURL = env.E2E_BASE_URL?.trim();
  const configuredBaseURL = explicitBaseURL || `http://127.0.0.1:8090${env.VITE_BASE_PATH ?? "/quantix"}`;
  const baseURL = configuredBaseURL.endsWith("/") ? configuredBaseURL : `${configuredBaseURL}/`;
  const e2eUploadDir = env.E2E_UPLOAD_DIR ?? "/tmp/quantix-playwright-uploads";
  const e2eDbName = env.E2E_DB_NAME ?? "vaultdrive_playwright";
  const e2eAdminDbUrl =
    env.E2E_ADMIN_DB_URL ??
    "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable";
  const e2eDbUrl =
    env.E2E_DB_URL ??
    `postgres://postgres:postgres@localhost:5432/${e2eDbName}?sslmode=disable`;

  // Filter out VITE_ variables to prevent overriding the build-time environment.
  const cleanProcessEnv = Object.keys(env).reduce((acc, key) => {
    if (!key.startsWith("VITE_") && env[key] !== undefined) {
      acc[key] = env[key];
    }
    return acc;
  }, {} as Record<string, string>);

  const e2eBackendEnv = {
    ...cleanProcessEnv,
    PORT: env.PORT ?? "8090",
    DB_URL: env.DB_URL ?? e2eDbUrl,
    JWT_SECRET:
      env.JWT_SECRET ?? "local-dev-secret-minimum-32-characters-long",
    BASE_PATH: env.BASE_PATH ?? "/quantix/",
    UPLOAD_DIR: env.UPLOAD_DIR ?? e2eUploadDir,
    E2E_DB_NAME: e2eDbName,
    E2E_ADMIN_DB_URL: e2eAdminDbUrl,
    ENABLE_ARGON2ID: "true",
  };

  return defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    forbidOnly: !!env.CI,
    retries: env.CI ? 2 : 0,
    workers: env.CI ? 1 : undefined,
    reporter: env.CI
      ? [["github"], ["html", { open: "never" }]]
      : [["list"], ["html", { open: "never" }]],
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
    webServer: explicitBaseURL
      ? undefined
      : {
          command:
            "npm run build -- --mode test" +
            " && cd .." +
            " && mkdir -p \"$UPLOAD_DIR\"" +
            " && (psql \"$E2E_ADMIN_DB_URL\" -tAc \"SELECT 1 FROM pg_database WHERE datname = '$E2E_DB_NAME'\" | grep -q 1 || psql \"$E2E_ADMIN_DB_URL\" -c \"CREATE DATABASE \\\"$E2E_DB_NAME\\\"\" || true)" +
            " && go run github.com/pressly/goose/v3/cmd/goose@latest -dir sql/schema postgres \"$DB_URL\" up" +
            " && go run .",
          env: e2eBackendEnv,
          url: baseURL,
          reuseExistingServer: !env.CI,
          timeout: 300000,
        },
  });
}

export default createPlaywrightConfig();
