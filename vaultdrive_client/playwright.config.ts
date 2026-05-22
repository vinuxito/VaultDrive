import { defineConfig } from "@playwright/test";

const configuredBaseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8090/quantix";
const baseURL = configuredBaseURL.endsWith("/") ? configuredBaseURL : `${configuredBaseURL}/`;
const e2eUploadDir = process.env.E2E_UPLOAD_DIR ?? "/tmp/quantix-playwright-uploads";
const e2eDbName = process.env.E2E_DB_NAME ?? "vaultdrive_playwright";
const e2eAdminDbUrl =
  process.env.E2E_ADMIN_DB_URL ??
  "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable";
const e2eDbUrl =
  process.env.E2E_DB_URL ??
  `postgres://postgres:postgres@localhost:5432/${e2eDbName}?sslmode=disable`;
const e2eBackendEnv = {
  ...process.env,
  PORT: process.env.PORT ?? "8090",
  DB_URL: process.env.DB_URL ?? e2eDbUrl,
  JWT_SECRET:
    process.env.JWT_SECRET ?? "local-dev-secret-minimum-32-characters-long",
  BASE_PATH: process.env.BASE_PATH ?? "/quantix/",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? e2eUploadDir,
  E2E_DB_NAME: e2eDbName,
  E2E_ADMIN_DB_URL: e2eAdminDbUrl,
  ENABLE_ARGON2ID: "true",
};

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
    command:
      // 1. Rebuild frontend with .env.test (QuantiX branding) so dist paths + labels match E2E expectations.
      // 2. cd to project root, provision the test database and run migrations.
      // 3. Start the Go backend which serves from vaultdrive_client/dist/.
      "npm run build -- --mode test" +
      " && cd .." +
      " && mkdir -p \"$UPLOAD_DIR\"" +
      " && (psql \"$E2E_ADMIN_DB_URL\" -tAc \"SELECT 1 FROM pg_database WHERE datname = '$E2E_DB_NAME'\" | grep -q 1 || psql \"$E2E_ADMIN_DB_URL\" -c \"CREATE DATABASE \\\"$E2E_DB_NAME\\\"\" || true)" +
      " && go run github.com/pressly/goose/v3/cmd/goose@latest -dir sql/schema postgres \"$DB_URL\" up" +
      " && PORT=8090 go run .",
    env: e2eBackendEnv,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300000,
  },
});
