import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

test("quick share opens the verified credential flow without creating a fragmentless grant", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("token", `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.fixture`);
    localStorage.setItem("user", JSON.stringify({ id: "coherence-owner", username: "Fixture", pin_set: true }));
    localStorage.setItem("i18nextLng", "en");
  });
  let grants = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/share-link") && route.request().method() === "POST") {
      grants++;
      await route.fulfill({ json: { token: "fragmentless-regression" } });
      return;
    }
    await route.fulfill({ json: path.endsWith("/api/files") ? [{
      id: "quick-share-file", filename: "Quick share fixture.txt", is_owner: true,
      file_size: 30, created_at: "2026-09-14T00:00:00Z",
      metadata: JSON.stringify({ credential_scheme: "pin", salt: "AAAAAAAAAAAAAAAAAAAAAA==", iv: "AAAAAAAAAAAAAAAA" }),
    }] : [] });
  });
  await page.goto("files");
  const row = page.locator("#file-row-quick-share-file");
  await row.hover();
  await row.getByTitle(/^Quick Share/).click();
  await expect(page.locator("#csl-credential")).toBeVisible({ timeout: 5000 });
  expect(grants).toBe(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(grants).toBe(0);
});
