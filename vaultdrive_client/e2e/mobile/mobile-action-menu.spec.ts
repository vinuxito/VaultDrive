import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
  uploadFileAsOwner,
} from "../helpers/trust";

test.describe("Mobile action menu bottom sheet", () => {
  test("opens action menu bottom sheet on mobile and respects touch targets & backdrop close", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    // Upload a file first so we have a row with actions
    await uploadFileAsOwner(page, account, {
      name: "mobile-test-file.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Mobile drawer viewport verification content"),
    });

    // Verify file is visible
    await expect(page.getByText("mobile-test-file.txt")).toBeVisible({ timeout: 10000 });

    // Mobile action menu trigger button is visible under mobile viewports
    const trigger = page.locator('[data-testid^="file-actions-"]').first();
    await expect(trigger).toBeVisible({ timeout: 10000 });

    // Click the trigger to open the bottom sheet
    await trigger.click();

    // Verify mobile drawer backdrop and content are visible
    const backdrop = page.locator('[data-testid$="-backdrop"]').first();
    const content = page.locator('[data-testid$="-content"]').first();

    await expect(backdrop).toBeVisible();
    await expect(content).toBeVisible();

    // Verify touch target size of actions is at least 44px (WCAG compliant)
    const downloadAction = page.locator('[data-testid="row-action-download"]').first();
    await expect(downloadAction).toBeVisible();
    const boundingBox = await downloadAction.boundingBox();
    expect(boundingBox).toBeTruthy();
    if (boundingBox) {
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }

    // Dismiss drawer by clicking the backdrop
    await backdrop.click({ force: true });

    // Verify it is closed
    await expect(content).not.toBeVisible();
  });
});
