import { expect, test } from "@playwright/test";

import {
  buildOwnerAccount,
  clearLocalAuth,
  completeOnboarding,
  gotoStable,
  loginWithPassword,
  loginWithPin,
  registerAccount,
} from "./helpers/trust";

test.describe("Forced password key continuity", () => {
  test.setTimeout(180_000);

  test("rewraps a v2 account key before changing the password and preserves PIN login", async ({ page }) => {
    test.info().annotations.push({
      type: "fixture-boundary",
      description: "This cohort sets only the cached browser force_password_change flag to enter the existing screen; it does not prove an administrator-triggered reset.",
    });

    const account = buildOwnerAccount();
    const newPassword = "ChangedPassw0rd!789";

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account, "Forced password proof");

    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("user") ?? "null") as {
      force_password_change?: boolean;
      kek_envelope_version?: number;
      private_key_encrypted?: string;
    } | null);
    expect(before?.kek_envelope_version).toBe(2);
    expect(before?.private_key_encrypted).toBeTruthy();

    // Fixture boundary: the real account and encrypted key come from the private
    // backend. Only the cached routing flag is set to enter the existing gate.
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem("user") ?? "null") as Record<string, unknown> | null;
      if (!user) throw new Error("missing cached user fixture");
      localStorage.setItem("user", JSON.stringify({ ...user, force_password_change: true }));
    });
    await gotoStable(page, "/force-password-change");
    await expect(page.getByRole("heading", { name: "Password Change Required" })).toBeVisible();

    await page.locator("#old-password").fill(account.password);
    await page.locator("#new-password").fill(newPassword);
    await page.locator("#confirm-password").fill(newPassword);

    const mutationRequest = page.waitForRequest((request) =>
      request.method() === "POST" && request.url().endsWith("/api/users/change-password"),
    );
    const mutationResponse = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().endsWith("/api/users/change-password"),
    );
    await page.getByRole("button", { name: "Set New Password" }).click();

    const [request, response] = await Promise.all([mutationRequest, mutationResponse]);
    expect(response.ok(), `Password change failed (${response.status()}): ${await response.text()}`).toBeTruthy();
    expect(request.postDataJSON()).toMatchObject({
      old_password: account.password,
      new_password: newPassword,
      kek_envelope_version: 2,
    });
    expect(request.postDataJSON()).toHaveProperty("private_key_encrypted");
    await page.waitForURL((url) => url.pathname.endsWith("/dashboard"));

    const afterMutation = await page.evaluate(() => JSON.parse(localStorage.getItem("user") ?? "null") as {
      force_password_change?: boolean;
      kek_envelope_version?: number;
      private_key_encrypted?: string;
    } | null);
    expect(afterMutation?.force_password_change).toBe(false);
    expect(afterMutation?.kek_envelope_version).toBe(2);
    expect(afterMutation?.private_key_encrypted).toBeTruthy();
    expect(afterMutation?.private_key_encrypted).not.toBe(before?.private_key_encrypted);

    await clearLocalAuth(page);
    await loginWithPassword(page, { ...account, password: newPassword });
    const afterFreshPasswordLogin = await page.evaluate(() => JSON.parse(localStorage.getItem("user") ?? "null") as {
      kek_envelope_version?: number;
      pin_set?: boolean;
    } | null);
    expect(afterFreshPasswordLogin?.kek_envelope_version).toBe(2);
    expect(afterFreshPasswordLogin?.pin_set).toBe(true);

    await clearLocalAuth(page);
    await loginWithPin(page, account);
    await expect(page).not.toHaveURL(/\/login$/);
    const afterPinLogin = await page.evaluate(() => JSON.parse(localStorage.getItem("user") ?? "null") as {
      kek_envelope_version?: number;
      pin_set?: boolean;
    } | null);
    expect(afterPinLogin?.kek_envelope_version).toBe(2);
    expect(afterPinLogin?.pin_set).toBe(true);
  });
});
