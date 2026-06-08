import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
  clearLocalAuth,
  productName,
} from "./helpers/trust";

test.describe("Decentralized Master Key Recovery (Shamir SSSS)", () => {
  // Ensure viewport is wide enough
  test.use({ viewport: { width: 1280, height: 720 } });

  test("Owner sets up recovery, simulates password loss, custodians approve, owner resets password", async ({
    browser,
  }) => {
    // We need 3 contexts/pages to simulate 3 independent users: Owner, Custodian A, Custodian B
    const contextOwner = await browser.newContext();
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageOwner = await contextOwner.newPage();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    pageOwner.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("[Owner Console Error]", msg.text());
      }
    });

    pageA.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("[Custodian A Console Error]", msg.text());
      }
    });

    pageB.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("[Custodian B Console Error]", msg.text());
      }
    });

    const ownerAcc = buildOwnerAccount();
    const custodianA = buildOwnerAccount();
    const custodianB = buildOwnerAccount();

    console.log("Registering Custodian A:", custodianA.username);
    await registerAccount(pageA, custodianA);
    await loginWithPassword(pageA, custodianA);
    await completeOnboarding(pageA, custodianA, "Custodian A Vault");

    console.log("Registering Custodian B:", custodianB.username);
    await registerAccount(pageB, custodianB);
    await loginWithPassword(pageB, custodianB);
    await completeOnboarding(pageB, custodianB, "Custodian B Vault");

    console.log("Registering Owner:", ownerAcc.username);
    await registerAccount(pageOwner, ownerAcc);
    await loginWithPassword(pageOwner, ownerAcc);
    await completeOnboarding(pageOwner, ownerAcc, "Owner Recoverable Vault");

    // Owner navigates to settings
    console.log("Owner setting up custodians...");
    await gotoStable(pageOwner, "/settings");
    const securityTabOwner = pageOwner.getByRole("tab", { name: /Security/i });
    await expect(securityTabOwner).toBeVisible({ timeout: 15000 });
    await pageOwner.waitForTimeout(1000);
    await securityTabOwner.click();
    await expect(securityTabOwner).toHaveAttribute("aria-selected", "true", { timeout: 10000 });

    // Search and add Custodian A
    await pageOwner.locator("#custodian-search").fill(custodianA.username);
    await pageOwner.getByRole("button", { name: "Search", exact: true }).click();
    // Wait for search result and click to add
    const resultA = pageOwner.locator("button").filter({ hasText: new RegExp(`@${custodianA.username}`, "i") });
    await expect(resultA).toBeVisible({ timeout: 15000 });
    await resultA.click();

    // Search and add Custodian B
    await pageOwner.locator("#custodian-search").fill(custodianB.username);
    await pageOwner.getByRole("button", { name: "Search", exact: true }).click();
    const resultB = pageOwner.locator("button").filter({ hasText: new RegExp(`@${custodianB.username}`, "i") });
    await expect(resultB).toBeVisible({ timeout: 15000 });
    await resultB.click();

    // Select threshold 2 of 2
    await pageOwner.locator("#threshold-select").selectOption("2");

    // Click to enable/save config. If credentials are not in session vault, this triggers the password prompt
    await pageOwner.getByRole("button", { name: "Enable Custodian Recovery" }).click();

    // Fill setup-password if it became visible, then click save again
    const setupPassword = pageOwner.locator("#setup-password");
    if (await setupPassword.isVisible({ timeout: 3000 }).catch(() => false)) {
      await setupPassword.fill(ownerAcc.password);
      await pageOwner.getByRole("button", { name: "Enable Custodian Recovery" }).click();
    }

    // Wait for success message
    await expect(pageOwner.getByText("Custodian recovery configuration saved successfully.")).toBeVisible({ timeout: 20000 });

    // Logout owner to simulate password loss
    console.log("Owner logs out...");
    await clearLocalAuth(pageOwner);
    await gotoStable(pageOwner, "/login");

    // Owner clicks Recover Lost Account
    await pageOwner.getByRole("button", { name: "Recover Lost Account" }).click();
    await pageOwner.waitForURL(/\/recover/);

    // Owner requests recovery
    await pageOwner.locator("#recover-username").fill(ownerAcc.username);
    await pageOwner.getByRole("button", { name: "Request Account Recovery" }).click();

    // Page should go to "wait" phase
    await expect(pageOwner.getByText("Waiting for custodians to decrypt and approve shares...")).toBeVisible({ timeout: 20000 });

    // Custodian A navigates to settings, sees request, approves
    console.log("Custodian A approving recovery...");
    await gotoStable(pageA, "/settings");
    const securityTabA = pageA.getByRole("tab", { name: /Security/i });
    await expect(securityTabA).toBeVisible({ timeout: 15000 });
    await pageA.waitForTimeout(1000);
    await securityTabA.click();
    await expect(securityTabA).toHaveAttribute("aria-selected", "true", { timeout: 10000 });
    await expect(pageA.getByText(`@${ownerAcc.username}`)).toBeVisible({ timeout: 20000 });
    // Click Approve Recovery first to trigger the password prompt if credentials are not cached in the session vault
    await pageA.getByRole("button", { name: "Approve Recovery" }).click();
    const approvePasswordA = pageA.locator(`[id^="approve-password-"]`);
    if (await approvePasswordA.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approvePasswordA.fill(custodianA.password);
      await pageA.getByRole("button", { name: "Approve Recovery" }).click();
    }
    await expect(pageA.getByText(`Aprobación enviada con éxito para ${ownerAcc.username}.`)).toBeVisible({ timeout: 20000 });

    // Custodian B navigates to settings, sees request, approves
    console.log("Custodian B approving recovery...");
    await gotoStable(pageB, "/settings");
    const securityTabB = pageB.getByRole("tab", { name: /Security/i });
    await expect(securityTabB).toBeVisible({ timeout: 15000 });
    await pageB.waitForTimeout(1000);
    await securityTabB.click();
    await expect(securityTabB).toHaveAttribute("aria-selected", "true", { timeout: 10000 });
    await expect(pageB.getByText(`@${ownerAcc.username}`)).toBeVisible({ timeout: 20000 });
    // Click Approve Recovery first to trigger the password prompt if credentials are not cached in the session vault
    await pageB.getByRole("button", { name: "Approve Recovery" }).click();
    const approvePasswordB = pageB.locator(`[id^="approve-password-"]`);
    if (await approvePasswordB.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approvePasswordB.fill(custodianB.password);
      await pageB.getByRole("button", { name: "Approve Recovery" }).click();
    }
    await expect(pageB.getByText(`Aprobación enviada con éxito para ${ownerAcc.username}.`)).toBeVisible({ timeout: 20000 });

    // Owner's page should poll and advance to reset password phase
    console.log("Owner resetting password...");
    const newPass = "NewPassw0rd!QA123";
    const newPassField = pageOwner.locator("#new-password");
    await expect(newPassField).toBeVisible({ timeout: 25000 });
    await newPassField.fill(newPass);
    await pageOwner.locator("#confirm-password").fill(newPass);
    await pageOwner.getByRole("button", { name: "Recover & Reset Account" }).click();

    // Wait for success screen
    await expect(pageOwner.getByText("Account Recovered Successfully")).toBeVisible({ timeout: 20000 });

    // Owner logs in with the new password
    console.log("Owner logging in with new credentials...");
    await pageOwner.getByRole("button", { name: "Log In" }).click();
    await pageOwner.waitForURL(/\/login/);

    // Switch to Password tab if PIN tab is active by default
    await pageOwner.getByRole("button", { name: "Password", exact: true }).click();

    await pageOwner.locator("#login-email").fill(ownerAcc.email);
    await pageOwner.locator("#login-password").fill(newPass);
    await pageOwner.getByRole("button", { name: new RegExp(`Open ${productName}`, "i") }).click();

    // Verify redirect after login (since PIN was reset, it should prompt to setup a new PIN or re-onboard)
    await pageOwner.waitForURL((url) => !url.toString().includes("/login"), { timeout: 20000 });
    await expect(pageOwner).not.toHaveURL(/\/login/);
  });
});
