import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
  getAuthToken,
  resolveApiUrl,
} from "./helpers/trust";

test.describe("Upload link creation and anonymous file collection", () => {
  test("folder entry panel separates upload vs share and gates upload-link copy behind PIN", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    await page.getByRole("button", { name: /navigate to qa inbox/i }).click();
    await expect(page.getByRole("button", { name: /generate upload link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /share folder/i })).toBeVisible();
    await expect(page.getByText(/collect inbound uploads into this folder/i)).toBeVisible();
    await expect(page.getByText(/share folder unlocks after this folder already contains files/i)).toBeVisible();

    await page.getByRole("button", { name: /generate upload link/i }).click();

    // The create modal should show a folder selector and optional PIN
    await expect(page.locator("#folder")).toBeVisible();

    // Fill PIN if field is visible
    const uploadPinField = page.locator("#pin");
    if (await uploadPinField.isVisible()) {
      await uploadPinField.fill(account.pin);
    }

    // Create the link
    const createLinkButton = page.getByRole("button", { name: /^Create Link$/i });
    await createLinkButton.scrollIntoViewIfNeeded();
    await createLinkButton.evaluate((element: HTMLButtonElement) => element.click());

    await expect(page.getByText("POST /api/drop/create")).toBeVisible();
    await expect(page.getByLabel(/upload url/i)).toHaveValue(/#key=••••••••/i);

    await page.getByRole("button", { name: /copy full upload link/i }).last().click();
    const verifyPinField = page.getByLabel("4-digit PIN");
    await verifyPinField.fill("0000");
    await page.getByRole("button", { name: /verify pin and copy/i }).click();
    await expect(page.getByText(/that pin didn't match/i)).toBeVisible();

    await verifyPinField.fill(account.pin);
    await page.getByRole("button", { name: /verify pin and copy/i }).click();
    await expect.poll(async () => {
      const copiedVisible = await page.getByText("Copied!").isVisible().catch(() => false);
      const fallbackVisible = await page.getByText(/clipboard is unavailable/i).isVisible().catch(() => false);
      return copiedVisible || fallbackVisible;
    }).toBeTruthy();

    // Close the modal
    const doneButton = page.getByRole("button", { name: /^Done$/i });
    await doneButton.evaluate((element: HTMLButtonElement) => element.click());
    await expect(page.getByRole("heading", { name: /upload links/i })).toBeVisible();

    // The link list should now show at least one upload link
    await expect(page.getByRole("heading", { name: /files upload link/i })).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: test.info().outputPath("upload-link-created.png"),
      fullPage: true,
    });
  });

  test("anonymous sender can deliver file through upload link without an account", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    // Create an upload link via API
    const token = await getAuthToken(page);
    const foldersRes = await page.request.get(resolveApiUrl("/api/folders"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const folders = (await foldersRes.json()) as Array<{ id: string }>;
    const folderId = folders[0]?.id;
    expect(folderId).toBeTruthy();

    const dropRes = await page.request.post(resolveApiUrl("/api/drop/create"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        target_folder_id: folderId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        max_files: 0,
        pin: account.pin,
        link_name: "24h Expiry Link",
        description: "Short-lived upload link for E2E test",
        seal_after_upload: false,
      },
    });
    expect(dropRes.ok()).toBeTruthy();
    const dropData = (await dropRes.json()) as { upload_url: string };
    const uploadUrl = new URL(dropData.upload_url, new URL(page.url()).origin).toString();

    // Navigate as anonymous sender (new context — clear auth)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });

    // Verify the secure drop page loads
    await expect(page.getByText("Secure File Delivery")).toBeVisible();

    // Fill client message and upload a file
    await page.locator("#client-message").fill("Anonymous sender E2E proof");
    const uploadResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/drop/") && response.url().includes("/upload"),
    );
    await page.locator("#file-input").setInputFiles({
      name: "anon-delivery.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("file from anonymous sender — no account needed"),
    });
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.ok()).toBeTruthy();

    // Verify success screen
    await expect(page.getByText("Your files have been delivered securely.")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Delivery receipt")).toBeVisible();

    await page.screenshot({
      path: test.info().outputPath("anonymous-sender-delivery.png"),
      fullPage: true,
    });
  });

  test("upload link with 24h expiry shows correct expiration via API", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    const token = await getAuthToken(page);
    const foldersRes = await page.request.get(resolveApiUrl("/api/folders"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const folders = (await foldersRes.json()) as Array<{ id: string }>;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dropRes = await page.request.post(resolveApiUrl("/api/drop/create"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        target_folder_id: folders[0]!.id,
        expires_at: expiresAt.toISOString(),
        max_files: 0,
        pin: account.pin,
        link_name: "Expiry Verification Link",
        description: "Verify 24h expiry",
        seal_after_upload: false,
      },
    });
    expect(dropRes.ok()).toBeTruthy();

    // List tokens and verify the latest one has ~24h expiry
    const tokensRes = await page.request.get(resolveApiUrl("/api/drop/tokens"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(tokensRes.ok()).toBeTruthy();
    const tokens = (await tokensRes.json()) as Array<{
      id: string;
      expires_at: { Time: string; Valid: boolean } | string;
      created_at: string;
    }>;
    expect(tokens.length).toBeGreaterThan(0);

    // Find the most recently created token
    const sorted = [...tokens].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const latest = sorted[0]!;

    // Parse expiry — backend sends sql.NullTime as {Time, Valid}
    const expiryRaw = latest.expires_at;
    const expiryStr = typeof expiryRaw === "string" ? expiryRaw : expiryRaw.Time;
    const expiryDate = new Date(expiryStr);

    const diffHours = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60);
    // Should be roughly 24 hours (allow ±2 hours for test execution time)
    expect(diffHours).toBeGreaterThan(22);
    expect(diffHours).toBeLessThan(26);
  });

  test("empty folder panel keeps both actions visible and still drives the correct upload-link flow", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account, "Primary Inbox");

    const token = await getAuthToken(page);
    const createFolderResponse = await page.request.post(resolveApiUrl("/api/folders"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "Empty Intake",
      },
    });
    expect(createFolderResponse.ok()).toBeTruthy();
    const emptyFolder = (await createFolderResponse.json()) as { id: string; name: string };

    await gotoStable(page, "/files");

    await page.getByRole("button", { name: /navigate to empty intake/i }).click();

    await expect(page.getByRole("button", { name: /generate upload link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /share folder/i })).toBeDisabled();
    await expect(page.getByText(/share folder unlocks after this folder already contains files/i)).toBeVisible();

    await page.getByRole("button", { name: /generate upload link/i }).click();

    await expect(page.getByText(/someone else to upload files into Empty Intake/i)).toBeVisible();
    await expect(page.locator("#folder")).toHaveValue(emptyFolder.id);

    const uploadPinField = page.locator("#pin");
    if (await uploadPinField.isVisible()) {
      await uploadPinField.fill(account.pin);
    }

    await page.getByRole("button", { name: /^Create Link$/i }).click();
    await expect(page.getByText("POST /api/drop/create")).toBeVisible();
    await expect(page.getByText(/secure drop route ready/i)).toBeVisible();
  });
});
