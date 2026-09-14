import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const part = (value: unknown) => btoa(JSON.stringify(value)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
    localStorage.setItem("token", `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "state-fixture", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`);
    localStorage.setItem("user", JSON.stringify({ id: "state-fixture", username: "Fixture", pin_set: true, is_admin: true }));
    localStorage.setItem("i18nextLng", "en");
  });
});

test("admin failure is recoverable without presenting an empty user inventory", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/admin/users")) {
      attempts++;
      await route.fulfill({ status: attempts === 1 ? 503 : 200, json: attempts === 1 ? {} : [] });
    } else await route.fulfill({ json: [] });
  });
  await page.goto("admin");
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry user list" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(attempts).toBe(2);
});

test("an unavailable event ticket leaves the activity feed visibly reconnecting", async ({ page }) => {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ status: path.endsWith("/events/ticket") ? 503 : 200, json: path.endsWith("/healthz") ? { status: "ok", db_ping_ms: 1 } : [] });
  });
  await page.goto("files");
  await page.getByRole("button", { name: /notifications/i }).click();
  const feed = page.getByRole("dialog", { name: "Activity Feed" });
  await expect(feed.getByRole("status")).toContainText("Reconnecting");
  await expect(feed).toContainText("No activity received in this session");
  await page.keyboard.press("Escape");
  await expect(feed).toHaveCount(0);
});
