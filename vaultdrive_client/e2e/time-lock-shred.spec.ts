import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
  uploadFileAsOwner,
  getAuthToken,
  resolveApiUrl,
} from "./helpers/trust";

test.describe("Time-locked puzzles & Auto-shredding keys", () => {
  test("create a single-use share link that auto-shreds after one download", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    // Upload a file first
    await uploadFileAsOwner(page, account, {
      name: "shred-doc.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Sensitive intelligence to be shredded immediately"),
    });
    await expect(page.getByText("shred-doc.txt")).toBeVisible({ timeout: 10000 });

    const token = await getAuthToken(page);
    const filesRes = await page.request.get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const files = (await filesRes.json()) as Array<{ id: string; filename: string }>;
    const targetFile = files.find((f) => f.filename === "shred-doc.txt");
    expect(targetFile).toBeTruthy();

    // Create auto-shred share link (max_downloads = 1)
    const shareLinkRes = await page.request.post(
      resolveApiUrl(`/api/files/${targetFile!.id}/share-link`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          max_downloads: 1,
        },
      },
    );
    expect(shareLinkRes.ok()).toBeTruthy();
    const shareLinkData = (await shareLinkRes.json()) as { token: string };
    expect(shareLinkData.token).toBeTruthy();

    const shareToken = shareLinkData.token;

    // Verify info before download says max_downloads is 1
    const infoResBefore = await page.request.get(resolveApiUrl(`/api/share/${shareToken}/info`));
    expect(infoResBefore.ok()).toBeTruthy();
    const infoBefore = await infoResBefore.json();
    expect(infoBefore.max_downloads).toBe(1);

    // Download for the first time
    const downloadRes1 = await page.request.get(resolveApiUrl(`/api/share/${shareToken}`));
    expect(downloadRes1.ok()).toBeTruthy();

    // Verify it is now shredded (download 2 returns error, info returns is_shredded: true)
    const downloadRes2 = await page.request.get(resolveApiUrl(`/api/share/${shareToken}`));
    expect(downloadRes2.status()).toBe(410); // Gone

    const infoResAfter = await page.request.get(resolveApiUrl(`/api/share/${shareToken}/info`));
    expect(infoResAfter.ok()).toBeTruthy();
    const infoAfter = await infoResAfter.json();
    expect(infoAfter.is_shredded).toBe(true);
    expect(infoAfter.is_expired).toBe(true);
  });

  test("create a time-locked share link that blocks download until timestamp passes", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    // Upload a file first
    await uploadFileAsOwner(page, account, {
      name: "timelocked-doc.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Future release data"),
    });
    await expect(page.getByText("timelocked-doc.txt")).toBeVisible({ timeout: 10000 });

    const token = await getAuthToken(page);
    const filesRes = await page.request.get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const files = (await filesRes.json()) as Array<{ id: string; filename: string }>;
    const targetFile = files.find((f) => f.filename === "timelocked-doc.txt");
    expect(targetFile).toBeTruthy();

    // Create share link locked for the next 3 seconds
    const unlockAt = new Date(Date.now() + 3000).toISOString();
    const shareLinkRes = await page.request.post(
      resolveApiUrl(`/api/files/${targetFile!.id}/share-link`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          unlock_at: unlockAt,
        },
      },
    );
    expect(shareLinkRes.ok()).toBeTruthy();
    const shareLinkData = (await shareLinkRes.json()) as { token: string };
    const shareToken = shareLinkData.token;

    // Verify link is initially locked
    const infoResLocked = await page.request.get(resolveApiUrl(`/api/share/${shareToken}/info`));
    expect(infoResLocked.ok()).toBeTruthy();
    const infoLocked = await infoResLocked.json();
    expect(infoLocked.is_locked).toBe(true);

    // Try downloading, should fail with 403
    const downloadResLocked = await page.request.get(resolveApiUrl(`/api/share/${shareToken}`));
    expect(downloadResLocked.status()).toBe(403);

    // Wait 3.5 seconds
    await page.waitForTimeout(3500);

    // Verify link is unlocked
    const infoResUnlocked = await page.request.get(resolveApiUrl(`/api/share/${shareToken}/info`));
    expect(infoResUnlocked.ok()).toBeTruthy();
    const infoUnlocked = await infoResUnlocked.json();
    expect(infoUnlocked.is_locked).toBe(false);

    // Download should now succeed
    const downloadResUnlocked = await page.request.get(resolveApiUrl(`/api/share/${shareToken}`));
    expect(downloadResUnlocked.ok()).toBeTruthy();
  });
});
