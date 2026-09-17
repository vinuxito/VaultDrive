import assert from "node:assert/strict";

import { createPlaywrightConfig } from "../playwright.config-factory";

const externalConfig = createPlaywrightConfig({
  E2E_BASE_URL: "http://127.0.0.1:4173/abrn",
  E2E_API_BASE_URL: "http://127.0.0.1:4173/api",
});
assert.equal(externalConfig.use?.baseURL, "http://127.0.0.1:4173/abrn/");
assert.equal(externalConfig.webServer, undefined);
assert.equal(externalConfig.use?.launchOptions, undefined);
const installedBrowserConfig = createPlaywrightConfig({
  E2E_BASE_URL: "http://127.0.0.1:4173/abrn",
  E2E_API_BASE_URL: "http://127.0.0.1:4173/api",
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: "/opt/google/chrome/chrome",
  E2E_OUTPUT_DIR: "/tmp/coherence-test-results",
  E2E_REPORT_DIR: "/tmp/coherence-test-report",
});
assert.equal(installedBrowserConfig.use?.launchOptions?.executablePath, "/opt/google/chrome/chrome");
assert.equal(installedBrowserConfig.outputDir, "/tmp/coherence-test-results");
assert.deepEqual(installedBrowserConfig.reporter, [["list"], ["html", { open: "never", outputFolder: "/tmp/coherence-test-report" }]]);

for (const bad of [undefined, "", "https://abrndrive.filemonprime.net/abrn", "http://127.0.0.1:8082/abrn", "http://localhost:8091/abrn", "http://user:secret@127.0.0.1:8091/abrn", "http://127.0.0.1:8091/abrn?token=secret", "http://127.0.0.1:8091/abrn#key"]) {
  assert.throws(() => createPlaywrightConfig({ E2E_BASE_URL: bad, E2E_API_BASE_URL: "http://127.0.0.1:8091/api" }));
}
assert.throws(() => createPlaywrightConfig({ E2E_BASE_URL: "http://127.0.0.1:8091/abrn" }));
assert.throws(() => createPlaywrightConfig({ E2E_BASE_URL: "http://127.0.0.1:8091/abrn", E2E_API_BASE_URL: "http://127.0.0.1:8082/api" }));
assert.throws(() => createPlaywrightConfig({ E2E_BASE_URL: "http://127.0.0.1:8091/abrn", E2E_API_BASE_URL: "http://127.0.0.1:8092/api" }));
assert.throws(() => createPlaywrightConfig({ DB_URL: "production", UPLOAD_DIR: "live", VITE_BASE_PATH: "/abrn" }));
console.log("Prepared private-server mode and 12 unsafe/missing configuration cases verified; no implicit build, database, or service mutation.");
