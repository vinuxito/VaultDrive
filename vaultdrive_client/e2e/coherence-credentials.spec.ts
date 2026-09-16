import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import {
  buildOwnerAccount,
  clearLocalAuth,
  completeOnboarding,
  gotoStable,
  loginWithPassword,
  loginWithPin,
  productName,
  registerAccount,
  uploadFileAsOwner,
} from "./helpers/trust";

const VAULT_CACHE_KEYS = ["vault_cached_private_key", "vault_cached_credential"] as const;

function expiredJWT(): string {
  const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url");
  return `header.${payload}.signature`;
}

test.describe("Credential session recovery", () => {
  test.setTimeout(180_000);

  test("clears expired and malformed sessions and resumes only a safe intended route", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account, "Credential recovery proof");

    const storedUser = await page.evaluate(() => localStorage.getItem("user"));
    expect(storedUser).toBeTruthy();

    await page.evaluate(({ user, token, cacheKeys }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("refresh_token", "expired-refresh-material");
      localStorage.setItem("user", user!);
      cacheKeys.forEach((key) => sessionStorage.setItem(key, `sensitive-${key}`));
    }, { user: storedUser, token: expiredJWT(), cacheKeys: VAULT_CACHE_KEYS });

    await page.goto("./files?folder=must-not-survive#private-fragment", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: `Open ${productName}` })).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      token: localStorage.getItem("token"),
      refresh: localStorage.getItem("refresh_token"),
      user: localStorage.getItem("user"),
      privateKey: sessionStorage.getItem("vault_cached_private_key"),
      credential: sessionStorage.getItem("vault_cached_credential"),
    }))).toEqual({ token: null, refresh: null, user: null, privateKey: null, credential: null });

    await page.getByRole("button", { name: "Password", exact: true }).click();
    await page.locator("#login-email").fill(account.email);
    await page.locator("#login-password").fill(account.password);
    await page.getByRole("button", { name: `Open ${productName}` }).click();
    await page.waitForURL((url) => url.pathname.endsWith("/files"));
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");

    await page.evaluate(({ cacheKeys }) => {
      localStorage.setItem("token", "header.not-base64-json.signature");
      localStorage.setItem("refresh_token", "malformed-refresh-material");
      localStorage.setItem("user", "{malformed-user");
      cacheKeys.forEach((key) => sessionStorage.setItem(key, `sensitive-${key}`));
    }, { cacheKeys: VAULT_CACHE_KEYS });

    await page.goto("./settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
    await expect.poll(() => page.evaluate(() => ({
      token: localStorage.getItem("token"),
      refresh: localStorage.getItem("refresh_token"),
      user: localStorage.getItem("user"),
      privateKey: sessionStorage.getItem("vault_cached_private_key"),
      credential: sessionStorage.getItem("vault_cached_credential"),
    }))).toEqual({ token: null, refresh: null, user: null, privateKey: null, credential: null });
  });

  test("custodian recovery preserves RSA-wrapped bytes and identifies legacy PIN-derived bytes", async ({ browser }) => {
    test.setTimeout(300_000);
    const ownerContext = await browser.newContext();
    const custodianAContext = await browser.newContext();
    const custodianBContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const custodianAPage = await custodianAContext.newPage();
    const custodianBPage = await custodianBContext.newPage();
    const owner = buildOwnerAccount();
    const custodianA = buildOwnerAccount();
    const custodianB = buildOwnerAccount();
    const originalBytes = Buffer.from(`preexisting recovery proof ${owner.username}\n`, "utf8");
    const filename = `before-recovery-${owner.username}.txt`;
    const sharedBytes = Buffer.from(`RSA recovery proof ${owner.username}\n`, "utf8");
    const sharedFilename = `shared-before-recovery-${owner.username}.txt`;
    const newPassword = "RecoveredPassw0rd!456";
    const newPin = "8642";

    try {
      for (const [page, account, folder] of [
        [custodianAPage, custodianA, "Custodian A Vault"],
        [custodianBPage, custodianB, "Custodian B Vault"],
        [ownerPage, owner, "Owner Recovery Vault"],
      ] as const) {
        await registerAccount(page, account);
        await loginWithPassword(page, account);
        await completeOnboarding(page, account, folder);
      }

      await gotoStable(ownerPage, "/files");
      await uploadFileAsOwner(ownerPage, owner, {
        name: filename,
        mimeType: "text/plain",
        buffer: originalBytes,
      });
      await expect(ownerPage.getByText(filename)).toBeVisible();

      await gotoStable(custodianAPage, "/files");
      await uploadFileAsOwner(custodianAPage, custodianA, {
        name: sharedFilename,
        mimeType: "text/plain",
        buffer: sharedBytes,
      });
      const sourceRow = custodianAPage.locator('[id^="file-row-"]').filter({ hasText: sharedFilename });
      await expect(sourceRow).toBeVisible();
      await clearLocalAuth(custodianAPage);
      await gotoStable(custodianAPage, "/login");
      await custodianAPage.getByRole("button", { name: "Password", exact: true }).click();
      await loginWithPassword(custodianAPage, custodianA);
      await gotoStable(custodianAPage, "/files");
      await sourceRow.getByTitle("Share with user", { exact: true }).click();
      await custodianAPage.locator("#share-search").fill(owner.username);
      await custodianAPage.getByRole("button").filter({ hasText: owner.email }).click();
      const sharePin = custodianAPage.locator("#share-pin");
      await expect(sharePin).toBeVisible();
      await sharePin.fill("0000");
      await custodianAPage.getByRole("button", { name: "Share File", exact: true }).click();
      await expect(custodianAPage.getByText("That credential didn't unlock this file. Check it and try again.")).toBeVisible();
      await sharePin.fill(custodianA.pin);
      const shareResponse = custodianAPage.waitForResponse(
        (response) => response.url().includes("/api/files/") && response.url().endsWith("/share"),
        { timeout: 15_000 },
      );
      await custodianAPage.getByRole("button", { name: "Share File", exact: true }).click();
      const shareResult = await shareResponse;
      expect(shareResult.ok(), `Share API failed (${shareResult.status()}): ${await shareResult.text()}`).toBeTruthy();

      await gotoStable(ownerPage, "/settings");
      const ownerSecurity = ownerPage.getByRole("tab", { name: /Security/i });
      await expect(ownerSecurity).toBeVisible();
      await ownerSecurity.click();
      await ownerPage.locator("#custodian-search").fill(custodianA.username);
      await ownerPage.getByRole("button", { name: "Search", exact: true }).click();
      await ownerPage.locator("button").filter({ hasText: new RegExp(`@${custodianA.username}`, "i") }).click();
      await ownerPage.locator("#custodian-search").fill(custodianB.username);
      await ownerPage.getByRole("button", { name: "Search", exact: true }).click();
      await ownerPage.locator("button").filter({ hasText: new RegExp(`@${custodianB.username}`, "i") }).click();
      await ownerPage.locator("#threshold-select").selectOption("2");
      await ownerPage.getByRole("button", { name: "Enable Custodian Recovery" }).click();
      const setupPassword = ownerPage.locator("#setup-password");
      if (await setupPassword.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await setupPassword.fill(owner.password);
        await ownerPage.getByRole("button", { name: "Enable Custodian Recovery" }).click();
      }
      await expect(ownerPage.getByText("Custodian recovery configuration saved successfully.")).toBeVisible();

      await clearLocalAuth(ownerPage);
      await gotoStable(ownerPage, "/login");
      await ownerPage.getByRole("button", { name: "Recover Lost Account" }).click();
      await ownerPage.locator("#recover-username").fill(owner.username);
      await ownerPage.getByRole("button", { name: "Request Account Recovery" }).click();
      await expect(ownerPage.getByText("Waiting for custodians to decrypt and approve shares...")).toBeVisible();

      for (const [page, custodian] of [
        [custodianAPage, custodianA],
        [custodianBPage, custodianB],
      ] as const) {
        await gotoStable(page, "/settings");
        const securityTab = page.getByRole("tab", { name: /Security/i });
        await expect(securityTab).toBeVisible();
        await securityTab.click();
        await expect(page.getByText(`@${owner.username}`)).toBeVisible({ timeout: 20_000 });
        await page.getByRole("button", { name: "Approve Recovery" }).click();
        const approvalPassword = page.locator('[id^="approve-password-"]');
        if (await approvalPassword.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await approvalPassword.fill(custodian.password);
          await page.getByRole("button", { name: "Approve Recovery" }).click();
        }
        await expect(page.getByText(`Aprobación enviada con éxito para ${owner.username}.`)).toBeVisible();
      }

      await expect(ownerPage.locator("#new-password")).toBeVisible({ timeout: 25_000 });
      await ownerPage.locator("#new-password").fill(newPassword);
      await ownerPage.locator("#confirm-password").fill(newPassword);
      await ownerPage.getByRole("button", { name: "Recover & Reset Account" }).click();
      await expect(ownerPage.getByText("Account Recovered Successfully")).toBeVisible({ timeout: 20_000 });
      await ownerPage.getByRole("button", { name: "Log In" }).click();
      await ownerPage.getByRole("button", { name: "Password", exact: true }).click();
      await ownerPage.locator("#login-email").fill(owner.email);
      await ownerPage.locator("#login-password").fill(newPassword);
      await ownerPage.getByRole("button", { name: `Open ${productName}` }).click();

      await expect(ownerPage.getByText("What stays private")).toBeVisible({ timeout: 20_000 });
      await ownerPage.getByRole("button", { name: /Continue/i }).click();
      await ownerPage.locator("#onboarding-pin").fill(newPin);
      await ownerPage.locator("#onboarding-confirm-pin").fill(newPin);
      await ownerPage.locator("#onboarding-account-password").fill(newPassword);
      await ownerPage.getByRole("button", { name: /^Set PIN$/i }).click();
      await expect(ownerPage.locator("#onboarding-folder-name")).toBeVisible({ timeout: 20_000 });
      await ownerPage.getByRole("button", { name: /Skip for now/i }).click();
      await ownerPage.getByRole("button", { name: "Upload a file", exact: true }).click();
      await expect(ownerPage.getByText(filename)).toBeVisible({ timeout: 20_000 });

      // A PIN login proves the replacement PIN envelope can restore the RSA key
      // reconstructed by recovery, rather than reusing the password-login key.
      await clearLocalAuth(ownerPage);
      await loginWithPin(ownerPage, { ...owner, password: newPassword, pin: newPin });
      await gotoStable(ownerPage, "/shared");
      const sharedName = ownerPage.getByText(sharedFilename, { exact: true });
      await expect(sharedName).toBeVisible({ timeout: 20_000 });
      const sharedCard = sharedName.locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
      const sharedDownloadEvent = ownerPage.waitForEvent("download", { timeout: 20_000 });
      await sharedCard.getByRole("button").last().click();
      const sharedPin = ownerPage.locator("#shared-file-pin");
      if (await sharedPin.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sharedPin.fill(newPin);
        await ownerPage.getByRole("button", { name: "Decrypt & Download", exact: true }).click();
      }
      const sharedDownload = await sharedDownloadEvent;
      expect(sharedDownload.suggestedFilename()).toBe(sharedFilename);
      expect(await readFile((await sharedDownload.path())!)).toEqual(sharedBytes);

      await gotoStable(ownerPage, "/files");
      await expect(ownerPage.getByText(filename)).toBeVisible({ timeout: 20_000 });

      const fileRow = ownerPage.locator('[id^="file-row-"]').filter({ hasText: filename });
      await fileRow.getByTitle("Download", { exact: true }).click();
      const pinField = ownerPage.locator("#vault-credential");
      await expect(pinField).toBeVisible();
      await expect(ownerPage.getByRole("dialog").getByText(/Use the PIN or file password that encrypted this file/)).toBeVisible();
      await pinField.fill("0000");
      await ownerPage.getByRole("button", { name: /Decrypt.*Download/i }).click();
      const credentialError = ownerPage.getByRole("dialog").getByText("Incorrect PIN or file credential. Please try again.");
      await expect(credentialError).toBeVisible();
      await expect(pinField).toHaveValue("");

      await ownerPage.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      await fileRow.getByTitle("Download", { exact: true }).click();
      await expect(pinField).toBeVisible();
      await pinField.fill(newPin);
      const replacementPinResult = Promise.race([
        ownerPage.waitForEvent("download", { timeout: 20_000 }).then((download) => ({ kind: "download" as const, download })),
        credentialError.waitFor({ state: "visible", timeout: 20_000 }).then(() => ({ kind: "rejected" as const })),
      ]);
      await ownerPage.getByRole("button", { name: /Decrypt.*Download/i }).click();
      const result = await replacementPinResult;

      if (result.kind === "rejected") {
        // Preserve forensic evidence: the stored ciphertext is intact and still
        // decrypts with the retired PIN, while the newly enrolled PIN cannot.
        await ownerPage.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
        await fileRow.getByTitle("Download", { exact: true }).click();
        await pinField.fill(owner.pin);
        const retiredPinDownload = ownerPage.waitForEvent("download", { timeout: 20_000 });
        await ownerPage.getByRole("button", { name: /Decrypt.*Download/i }).click();
        const download = await retiredPinDownload;
        expect(download.suggestedFilename()).toBe(filename);
        expect(await readFile((await download.path())!)).toEqual(originalBytes);
      } else {
        expect(result.download.suggestedFilename()).toBe(filename);
        expect(await readFile((await result.download.path())!)).toEqual(originalBytes);
      }

      expect(result.kind, "A PIN-derived legacy file must truthfully reject the replacement PIN").toBe("rejected");
    } finally {
      await Promise.all([ownerContext.close(), custodianAContext.close(), custodianBContext.close()]);
    }
  });
});
