import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
  uploadFileAsOwner,
} from "./helpers/trust";

test.describe("Activity Receipt Drawer E2E Flow", () => {
  test("uploading and downloading a file generates correct audit receipts inside the slide-over drawer", async ({ page }) => {
    const account = buildOwnerAccount();

    // 1. Register & Login & Onboard
    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    // 2. Upload file
    const fileName = "receipt-test.txt";
    await uploadFileAsOwner(page, account, {
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from("Verification of security receipt drawer"),
    });

    // 3. Verify file is in list
    const fileRow = page.getByText(fileName);
    await expect(fileRow).toBeVisible({ timeout: 10000 });

    // 4. Verify pulsing green dot is visible
    const pulseBtn = page.locator(`[data-testid^="receipt-pulse-"]`).first();
    await expect(pulseBtn).toBeVisible();

    // 5. Click pulsing dot to open drawer
    await pulseBtn.click();

    // 6. Verify drawer is open and shows "File uploaded"
    const drawer = page.locator('[data-testid="receipt-drawer-panel"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("File uploaded")).toBeVisible();
    await expect(drawer.getByText("Owner", { exact: true })).toBeVisible();

    // 7. Close the drawer
    await page.locator('[aria-label="Close"]').click();
    await expect(drawer).not.toBeVisible();

    // 8. Download the file and wait for download to complete
    const downloadPromise = page.waitForEvent("download");
    await page.locator('button[title="Download"]').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(fileName);

    // 9. Reopen the drawer using the desktop actions bar receipt button
    const receiptActionBtn = page.locator(`[data-testid^="receipt-action-"]`).first();
    await expect(receiptActionBtn).toBeVisible();
    await receiptActionBtn.click();

    // 10. Verify drawer shows both "File uploaded" and "File decrypted/downloaded"
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("File uploaded")).toBeVisible();
    await expect(drawer.getByText("File decrypted/downloaded")).toBeVisible();
    await expect(drawer.getByText("Owner", { exact: true })).toHaveCount(2); // Both events performed by owner

    // Take a screenshot of the open drawer for visual evidence
    await page.screenshot({
      path: test.info().outputPath("receipt-drawer-open.png"),
      fullPage: true,
    });

    // Close the drawer to clean up
    await page.locator('[aria-label="Close"]').click();
    await expect(drawer).not.toBeVisible();
  });
});
