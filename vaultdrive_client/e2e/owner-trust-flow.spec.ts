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
