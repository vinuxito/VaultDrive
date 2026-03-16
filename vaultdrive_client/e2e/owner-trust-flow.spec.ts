import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  clearLocalAuth,
  completeOnboarding,
  gotoStable,
  loginWithPassword,
  loginWithPin,
  registerAccount,
} from "./helpers/trust";

test("owner trust flow supports signup, onboarding, and PIN login", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  await gotoStable(page, "/settings");
  await expect(page.getByText("One-PIN doctrine")).toBeVisible();
  await expect(page.getByText("Privacy & Trust")).toBeVisible();

  await clearLocalAuth(page);
  await loginWithPin(page, account);
  await expect(page).toHaveURL(/abrn$/);
});

test("owner action receipts expose the underlying API calls", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  await gotoStable(page, "/files");

  await page.getByRole("button", { name: "Manage" }).first().click();
  await page.getByRole("button", { name: /create (new )?link/i }).click();
  await expect(page.locator("#folder")).toBeVisible();
  const uploadPinField = page.locator("#pin");
  if (await uploadPinField.isVisible()) {
    await uploadPinField.fill(account.pin);
  }
  const createLinkButton = page.getByRole("button", { name: /^Create Link$/i });
  await createLinkButton.scrollIntoViewIfNeeded();
  await createLinkButton.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("POST /api/drop/create")).toBeVisible();
  await page.getByRole("button", { name: /^Done$/i }).click();

  await page.getByRole("button", { name: "Manage Requests" }).click();
  await page.getByRole("button", { name: /new request/i }).click();
  const createRequestButton = page.getByRole("button", { name: /^Create Request$/i });
  await createRequestButton.scrollIntoViewIfNeeded();
  await createRequestButton.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText("POST /api/file-requests")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("owner-api-call-receipts.png"), fullPage: true });
});

test("settings keeps advanced control-plane docs collapsed until requested", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  await gotoStable(page, "/settings");
  await expect(page.getByText("Control plane at a glance")).toBeVisible();
  await expect(page.getByText("Quick start")).not.toBeVisible();

  await page.getByRole("button", { name: /agent api reference/i }).click();
  await expect(page.getByText("Quick start")).toBeVisible();
});
