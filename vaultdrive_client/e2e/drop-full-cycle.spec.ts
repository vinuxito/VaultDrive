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

test.describe("Drop link full cycle: create → client upload → owner download", () => {
  // Ensure viewport is wide enough for desktop download button (hidden md:flex)
  test.use({ viewport: { width: 1280, height: 720 } });

  test("owner creates drop link, anonymous client uploads file, owner downloads and decrypts", async ({
    page,
  }) => {
    const account = buildOwnerAccount();

    // ── Step 1: Owner registers, logs in, completes onboarding ──
    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    // ── Step 2: Create a drop link via API and capture the full URL with #key= ──
    const token = await getAuthToken(page);
    const foldersRes = await page.request.get(resolveApiUrl("/api/folders"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(foldersRes.ok()).toBeTruthy();
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
        link_name: "E2E Full Cycle Link",
        description: "Full lifecycle test",
        seal_after_upload: false,
      },
    });
    expect(dropRes.ok(), `Drop create failed: ${dropRes.status()}`).toBeTruthy();
    const dropData = (await dropRes.json()) as { upload_url: string };
    const uploadUrl = new URL(
      dropData.upload_url,
      new URL(page.url()).origin
    ).toString();

    // Verify the URL contains the #key= fragment
    expect(uploadUrl).toContain("#key=");

    // ── Step 3: Clear auth and visit as anonymous client ──
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });

    // Verify drop page loads correctly
    await expect(page.getByText("Secure File Delivery")).toBeVisible();

    // Upload a file as anonymous client
    const fileContent = "E2E drop lifecycle proof — " + Date.now();
    await page.locator("#client-message").fill("Full cycle E2E test delivery");
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/drop/") &&
        response.url().includes("/upload")
    );
    await page.locator("#file-input").setInputFiles({
      name: "drop-cycle-proof.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(fileContent),
    });
    const uploadResponse = await uploadResponsePromise;
    expect(
      uploadResponse.ok(),
      `Client upload failed: ${uploadResponse.status()} — ${await uploadResponse.text()}`
    ).toBeTruthy();

    // Verify success screen
    await expect(
      page.getByText("Your files have been delivered securely.")
    ).toBeVisible({ timeout: 30000 });

    // ── Step 4: Log back in as owner and navigate to files ──
    await gotoStable(page, "/login");
    await loginWithPassword(page, account);
    await gotoStable(page, "/files");

    // Verify the drop-uploaded file appears in the vault
    await expect(page.getByText("drop-cycle-proof.txt")).toBeVisible({
      timeout: 15000,
    });

    // ── Step 5: Verify download + decryption via UI ──
    // Intercept download API call to verify server returns 200 + correct headers
    const downloadApiPromise = page.waitForResponse(
      (r) => r.url().includes("/api/files/") && r.url().includes("/download"),
      { timeout: 30000 }
    );

    // Click the download button next to the file (desktop view: button[title="Download"])
    const downloadBtn = page.locator("button[title='Download']").first();
    await downloadBtn.click();

    // PIN modal should appear for drop-uploaded files
    const pinInput = page.locator("#vault-credential");
    await expect(pinInput).toBeVisible({ timeout: 5000 });
    await pinInput.fill(account.pin);

    // Click "Decrypt & Download"
    await page.getByRole("button", { name: /Decrypt & Download/i }).click();

    // Verify the download API returned 200 with X-Wrapped-Key header
    const downloadApiRes = await downloadApiPromise;
    expect(
      downloadApiRes.ok(),
      `Download API failed: ${downloadApiRes.status()}`
    ).toBeTruthy();
    const xWrappedKey = downloadApiRes.headers()["x-wrapped-key"];
    expect(xWrappedKey, "X-Wrapped-Key header missing — decryption would fail").toBeTruthy();

    // After successful decryption, the PIN modal should close (no error = modal dismissed)
    await expect(pinInput).not.toBeVisible({ timeout: 30000 });

    // Verify no error banner appeared (the actual error uses bg-red-50 container with text-red-800)
    const errorBanner = page.locator(".bg-red-50 .text-red-800");
    const hasError = await errorBanner.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError, "Error appeared during download/decryption").toBe(false);

    await page.screenshot({
      path: test.info().outputPath("drop-full-cycle-complete.png"),
      fullPage: true,
    });
  });

  test("owner can recover drop link key via PIN and re-share with client", async ({
    page,
  }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    // Create a drop link
    const token = await getAuthToken(page);
    const foldersRes = await page.request.get(resolveApiUrl("/api/folders"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const folders = (await foldersRes.json()) as Array<{ id: string }>;

    const dropRes = await page.request.post(resolveApiUrl("/api/drop/create"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        target_folder_id: folders[0]!.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        max_files: 0,
        pin: account.pin,
        link_name: "Key Recovery Test Link",
        description: "Test PIN-based key recovery",
        seal_after_upload: false,
      },
    });
    expect(dropRes.ok()).toBeTruthy();
    const dropData = (await dropRes.json()) as { upload_url: string };

    // Extract the token from the URL
    const urlPath = dropData.upload_url.split("#")[0]!;
    const dropToken = urlPath.split("/").pop()!;

    // Use the key recovery API to get the key back
    const recoverRes = await page.request.post(
      resolveApiUrl(`/api/drop/${dropToken}/recover-key`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { pin: account.pin },
      }
    );
    expect(
      recoverRes.ok(),
      `Key recovery failed: ${recoverRes.status()}`
    ).toBeTruthy();
    const recoverData = (await recoverRes.json()) as {
      encryption_key: string;
    };
    expect(recoverData.encryption_key).toBeTruthy();
    expect(recoverData.encryption_key.length).toBeGreaterThan(10);

    // Reconstruct the full URL and verify it works for upload
    const fullUrl = new URL(
      `${urlPath}#key=${recoverData.encryption_key}`,
      new URL(page.url()).origin
    ).toString();

    // Clear auth and visit the recovered URL as anonymous client
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(fullUrl, { waitUntil: "domcontentloaded" });

    // The drop page should load without errors
    await expect(page.getByText("Secure File Delivery")).toBeVisible();

    // Upload a file to prove the recovered key works
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/drop/") &&
        response.url().includes("/upload")
    );
    await page.locator("#file-input").setInputFiles({
      name: "recovered-key-proof.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("File uploaded with recovered key"),
    });
    const uploadResponse = await uploadResponsePromise;
    expect(
      uploadResponse.ok(),
      `Upload with recovered key failed: ${uploadResponse.status()}`
    ).toBeTruthy();

    await expect(
      page.getByText("Your files have been delivered securely.")
    ).toBeVisible({ timeout: 30000 });
  });

  test("wrong PIN is rejected by key recovery endpoint", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    const token = await getAuthToken(page);
    const foldersRes = await page.request.get(resolveApiUrl("/api/folders"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const folders = (await foldersRes.json()) as Array<{ id: string }>;

    const dropRes = await page.request.post(resolveApiUrl("/api/drop/create"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        target_folder_id: folders[0]!.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        max_files: 0,
        pin: account.pin,
        link_name: "Wrong PIN Test",
        description: "Should reject wrong PIN",
        seal_after_upload: false,
      },
    });
    expect(dropRes.ok()).toBeTruthy();
    const dropData = (await dropRes.json()) as { upload_url: string };
    const dropToken = dropData.upload_url.split("#")[0]!.split("/").pop()!;

    // Attempt key recovery with wrong PIN
    const recoverRes = await page.request.post(
      resolveApiUrl(`/api/drop/${dropToken}/recover-key`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { pin: "9999" },
      }
    );
    expect(recoverRes.ok()).toBeFalsy();
    expect(recoverRes.status()).toBeGreaterThanOrEqual(400);
  });
});
