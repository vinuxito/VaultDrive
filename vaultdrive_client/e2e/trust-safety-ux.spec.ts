import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
} from "./helpers/trust";

test.describe("Trust and safety UX flows", () => {
  test("PIN setup during onboarding shows confirmation and security messaging", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);

    // Navigate to files — should trigger onboarding
    await gotoStable(page, "/files");

    // Onboarding step 1: Continue
    await page.getByRole("button", { name: /Continue/i }).click();

    // PIN setup form should show clear security messaging
    await expect(page.locator("#onboarding-pin")).toBeVisible();
    await expect(page.locator("#onboarding-confirm-pin")).toBeVisible();

    // Fill PIN
    await page.locator("#onboarding-pin").fill(account.pin);
    await page.locator("#onboarding-confirm-pin").fill(account.pin);
    await page.locator("#onboarding-account-password").fill(account.password);

    // Set PIN button should be visible
    await expect(page.getByRole("button", { name: /^Set PIN$/i })).toBeVisible();
    await page.getByRole("button", { name: /^Set PIN$/i }).click();

    // After PIN set — folder creation step
    await expect(page.locator("#onboarding-folder-name")).toBeVisible();
    await page.locator("#onboarding-folder-name").fill("Trust Verified Inbox");
    await page.getByTestId("onboarding-create-folder").click();

    // Final step — "Enter Protected Vault" button shows security confidence
    await expect(page.getByRole("button", { name: /Enter Protected Vault/i })).toBeVisible();
    await page.getByRole("button", { name: /Enter Protected Vault/i }).click();

    // User is now in the vault
    await expect(page.getByText("No files here yet")).toBeVisible();

    await page.screenshot({
      path: test.info().outputPath("pin-setup-complete.png"),
      fullPage: true,
    });
  });

  test("Settings Security tab shows One PIN for everything and Privacy & Trust", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/settings");

    // Security tab — clear safety signals
    await page.getByRole("tab", { name: "Security" }).click();
    await expect(page.getByText("One PIN for everything")).toBeVisible();
    await expect(page.getByText("Privacy & Trust")).toBeVisible();
    await expect(page.getByText("AES-256-GCM")).toBeVisible();

    await page.screenshot({
      path: test.info().outputPath("settings-security-trust.png"),
      fullPage: true,
    });
  });

  test("empty states provide clear guidance with no ambiguous messaging", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    // Files page — empty state
    await gotoStable(page, "/files");
    await expect(page.getByText("No files here yet")).toBeVisible();
    await expect(page.getByText("Upload a file to start your encrypted vault")).toBeVisible();

    // Groups page — empty state
    await gotoStable(page, "/groups");
    await expect(page.getByText("No groups yet")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Create your first group")).toBeVisible();

    // Shared with Me page — empty state
    await gotoStable(page, "/shared");
    await expect(page.getByText("Ask someone to share a file").or(page.getByText("No files shared"))).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: test.info().outputPath("empty-states-guidance.png"),
      fullPage: true,
    });
  });

  test("upload link creation shows API call trace receipt for trust transparency", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    // Create upload link and verify the API call receipt is shown
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

    // Trust receipt: API call trace is visible after creation
    await expect(page.getByText("POST /api/drop/create")).toBeVisible();

    await page.screenshot({
      path: test.info().outputPath("trust-receipt-api-trace.png"),
      fullPage: true,
    });
  });

  test("drop upload page shows encryption footer for peace of mind", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    // Create an upload link via API
    const token = await page.evaluate(() => localStorage.getItem("token") ?? "");
    const basePath = process.env.VITE_BASE_PATH ?? "/quantix";
    const foldersRes = await page.request.get(
      `${new URL(page.url()).origin}${basePath}/api/folders`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const folders = (await foldersRes.json()) as Array<{ id: string }>;

    const dropRes = await page.request.post(
      `${new URL(page.url()).origin}${basePath}/api/drop/create`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          target_folder_id: folders[0]!.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          max_files: 0,
          pin: account.pin,
          link_name: "Trust Footer Link",
          description: "Verify encryption footer",
          seal_after_upload: false,
        },
      },
    );
    const dropData = (await dropRes.json()) as { upload_url: string };
    const uploadUrl = new URL(dropData.upload_url, new URL(page.url()).origin).toString();

    // Visit the drop upload page
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });

    // Verify the encryption trust signals on the drop upload page
    await expect(page.getByText("Secure File Delivery")).toBeVisible();
    await expect(page.getByText("End-to-end encrypted")).toBeVisible();
    await expect(page.getByText(/encrypted in.*browser/).first()).toBeVisible();

    await page.screenshot({
      path: test.info().outputPath("drop-upload-trust-footer.png"),
      fullPage: true,
    });
  });
});
