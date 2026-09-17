import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
  uploadFileAsOwner,
} from "./helpers/trust";

test.describe("v11 Sovereign Vault UI/UX E2E Verification", () => {
  test("exercises spatial keyboard traversal, Passport drawer, Staging Dock, and Privacy Shutter", async ({ page }) => {
    const account = buildOwnerAccount();

    // 1. Authenticate & Land on /files
    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);
    await gotoStable(page, "/files");

    // 2. Upload two distinct files to test spatial traversal
    const fileA = "sovereign_manifest_alpha.txt";
    const fileB = "sovereign_manifest_beta.txt";

    await uploadFileAsOwner(page, account, {
      name: fileA,
      mimeType: "text/plain",
      buffer: Buffer.from("Alpha sovereign payload for mathematical verification"),
    });

    await uploadFileAsOwner(page, account, {
      name: fileB,
      mimeType: "text/plain",
      buffer: Buffer.from("Beta sovereign payload for mathematical verification"),
    });

    // 3. Verify files render in list
    await expect(page.getByText(fileA)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(fileB)).toBeVisible({ timeout: 10000 });

    // 4. Test Pointer Cursor Affordance on file rows
    const firstRow = page.locator(`[id^="file-row-"]`).first();
    await expect(firstRow).toHaveClass(/cursor-pointer/);

    // 5. Test Spatial Traversal with J / K
    // Press 'j' to navigate to first/next file
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // 6. Test Staging Dock via 'x'
    await page.keyboard.press("x");
    const stagingDock = page.getByRole("region", { name: /Executive Staging Dock/i });
    await expect(stagingDock).toBeVisible({ timeout: 5000 });
    await expect(stagingDock.getByText("Staged for Action")).toBeVisible();

    // Clear staging dock via Escape
    await page.keyboard.press("Escape");
    await expect(stagingDock).not.toBeVisible();

    // 7. Test Cryptographic Passport Drawer via hotkey 'p'
    await page.keyboard.press("p");
    const passportDrawer = page.getByRole("heading", { name: "Cryptographic Passport" });
    await expect(passportDrawer).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Golden SHA-256 Seal")).toBeVisible();
    await expect(page.getByText("AES-256-GCM")).toBeVisible();
    await expect(page.getByText("v2 Sovereign")).toBeVisible();

    // Close passport drawer via Escape
    await page.keyboard.press("Escape");
    await expect(passportDrawer).not.toBeVisible();

    // 8. Test Privacy Shutter via hotkey Meta+L / Control+L
    await page.keyboard.press("Control+l");
    const privacyShutter = page.getByRole("dialog", { name: "Vault Privacy Shutter" });
    await expect(privacyShutter).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Vault Locked for Privacy")).toBeVisible();

    // Unlock Privacy Shutter by clicking Resume Sovereign Session button
    const unlockBtn = page.getByRole("button", { name: "Resume Sovereign Session" });
    await unlockBtn.click();
    await expect(privacyShutter).not.toBeVisible();
  });
});
