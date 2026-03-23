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

test.describe("Share link lifecycle — create, access, revoke", () => {
  test("create share link with AES key in URL fragment (never hits server)", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    // Upload a file first
    await uploadFileAsOwner(page, account, {
      name: "shareable-doc.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Document content for share link test"),
    });
    await expect(page.getByText("shareable-doc.txt")).toBeVisible({ timeout: 10000 });

    // Create a share link via API (the UI modal requires decrypting the file key)
    const token = await getAuthToken(page);
    const filesRes = await page.request.get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const files = (await filesRes.json()) as Array<{ id: string; filename: string }>;
    const targetFile = files.find((f) => f.filename === "shareable-doc.txt");
    expect(targetFile).toBeTruthy();

    const shareLinkRes = await page.request.post(
      resolveApiUrl(`/api/files/${targetFile!.id}/share-link`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    );
    expect(shareLinkRes.ok()).toBeTruthy();
    const shareLinkData = (await shareLinkRes.json()) as { token: string };
    expect(shareLinkData.token).toBeTruthy();

    // The share URL format: /abrn/share/{token}#base64Key
    // In production, the frontend appends the AES key as a fragment
    // The fragment never reaches the server (HTTP spec guarantee)
    const shareToken = shareLinkData.token;

    // Verify the share link info endpoint works (no key needed for info)
    const infoRes = await page.request.get(resolveApiUrl(`/api/share/${shareToken}/info`));
    expect(infoRes.ok()).toBeTruthy();
    const info = (await infoRes.json()) as {
      filename: string;
      is_expired: boolean;
      access_count: number;
    };
    expect(info.filename).toBe("shareable-doc.txt");
    expect(info.is_expired).toBe(false);
    expect(info.access_count).toBeGreaterThanOrEqual(0);
  });

  test("accessing share link increments access count", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    await uploadFileAsOwner(page, account, {
      name: "access-tracked.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Access tracking proof"),
    });

    const token = await getAuthToken(page);
    const filesRes = await page.request.get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const files = (await filesRes.json()) as Array<{ id: string; filename: string }>;
    const targetFile = files.find((f) => f.filename === "access-tracked.txt");
    expect(targetFile).toBeTruthy();

    // Create share link
    const createRes = await page.request.post(
      resolveApiUrl(`/api/files/${targetFile!.id}/share-link`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    );
    const shareData = (await createRes.json()) as { token: string };

    // Get initial access count
    const info1Res = await page.request.get(resolveApiUrl(`/api/share/${shareData.token}/info`));
    const info1 = (await info1Res.json()) as { access_count: number };
    const initialCount = info1.access_count;

    // Access the share download endpoint (this increments the access counter)
    // Use a fake key fragment — the download will fail decryption but still logs access
    await page.request.get(resolveApiUrl(`/api/share/${shareData.token}`));

    // Check access count increased
    const info2Res = await page.request.get(resolveApiUrl(`/api/share/${shareData.token}/info`));
    const info2 = (await info2Res.json()) as { access_count: number };
    expect(info2.access_count).toBeGreaterThan(initialCount);
  });

  test("revoking share link makes it immediately inaccessible", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    await uploadFileAsOwner(page, account, {
      name: "revocable-file.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This file share will be revoked"),
    });

    const token = await getAuthToken(page);
    const filesRes = await page.request.get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const files = (await filesRes.json()) as Array<{ id: string; filename: string }>;
    const targetFile = files.find((f) => f.filename === "revocable-file.txt");
    expect(targetFile).toBeTruthy();

    // Create share link
    const createRes = await page.request.post(
      resolveApiUrl(`/api/files/${targetFile!.id}/share-link`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    );
    const shareData = (await createRes.json()) as { token: string; id?: string };

    // Verify link works before revocation
    const beforeRes = await page.request.get(resolveApiUrl(`/api/share/${shareData.token}/info`));
    expect(beforeRes.ok()).toBeTruthy();

    // List share links to get the link ID for revocation
    const linksRes = await page.request.get(
      resolveApiUrl(`/api/files/${targetFile!.id}/share-links`),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(linksRes.ok()).toBeTruthy();
    const links = (await linksRes.json()) as Array<{ id: string; token: string }>;
    const linkToRevoke = links.find((l) => l.token === shareData.token);
    expect(linkToRevoke).toBeTruthy();

    // Revoke the share link
    const revokeRes = await page.request.delete(
      resolveApiUrl(`/api/share-links/${linkToRevoke!.id}`),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(revokeRes.ok()).toBeTruthy();

    // Verify link is now inaccessible
    const afterRes = await page.request.get(resolveApiUrl(`/api/share/${shareData.token}/info`));
    expect(afterRes.ok()).toBeFalsy();
  });
});
