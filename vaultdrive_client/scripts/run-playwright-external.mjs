import { spawnSync } from "node:child_process";

const baseURL = process.env.E2E_BASE_URL?.trim();

if (!baseURL || !process.env.E2E_API_BASE_URL?.trim()) {
  console.error("E2E_BASE_URL and E2E_API_BASE_URL are required for the external Playwright runner.");
  process.exitCode = 2;
} else {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    command,
    ["playwright", "test", ...process.argv.slice(2)],
    {
      env: { ...process.env, E2E_BASE_URL: baseURL },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
}
