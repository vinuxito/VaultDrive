import assert from "node:assert/strict";

import { createPlaywrightConfig } from "../playwright.config";

const externalConfig = createPlaywrightConfig({
  E2E_BASE_URL: "http://127.0.0.1:4173/abrn",
});
assert.equal(externalConfig.use?.baseURL, "http://127.0.0.1:4173/abrn/");
assert.equal(externalConfig.webServer, undefined);
assert.equal(externalConfig.use?.launchOptions, undefined);
const installedBrowserConfig = createPlaywrightConfig({
  E2E_BASE_URL: "http://127.0.0.1:4173/abrn",
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: "/opt/google/chrome/chrome",
});
assert.equal(installedBrowserConfig.use?.launchOptions?.executablePath, "/opt/google/chrome/chrome");

const selfHostedConfig = createPlaywrightConfig({
  VITE_BASE_PATH: "/quantix",
});
assert.equal(selfHostedConfig.use?.baseURL, "http://127.0.0.1:8090/quantix/");
assert.ok(selfHostedConfig.webServer);
assert.equal(selfHostedConfig.webServer.url, "http://127.0.0.1:8090/quantix/");
assert.equal(selfHostedConfig.webServer.reuseExistingServer, true);

const blankExternalConfig = createPlaywrightConfig({ E2E_BASE_URL: "   " });
assert.ok(blankExternalConfig.webServer);

console.log("Playwright config modes verified: external preview and self-hosted.");
