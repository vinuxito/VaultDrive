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

test.describe("Sharing files with groups", () => {
  test("share file with group, file appears in group files for both owner and member", async ({ page }) => {
    const owner = buildOwnerAccount();
    const member = buildOwnerAccount();

    // Register and onboard owner
    await registerAccount(page, owner);
    await loginWithPassword(page, owner);
    await completeOnboarding(page, owner);
    const ownerToken = await getAuthToken(page);

    // Upload a file as owner
    await gotoStable(page, "/files");
    await uploadFileAsOwner(page, owner, {
      name: "group-shared-file.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("File shared with group for E2E test"),
    });

    // Get file ID
    const filesRes = await page.request.get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const files = (await filesRes.json()) as Array<{ id: string; filename: string }>;
    const sharedFile = files.find((f) => f.filename === "group-shared-file.txt");
    expect(sharedFile).toBeTruthy();

    // Register member
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await registerAccount(page, member);
    await loginWithPassword(page, member);
    await completeOnboarding(page, member);
    const memberToken = await getAuthToken(page);

    // Get member user ID
    const memberMeRes = await page.request.get(resolveApiUrl("/api/users/me"), {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const memberMe = (await memberMeRes.json()) as { id: string };

    // Create group as owner
    const groupRes = await page.request.post(resolveApiUrl("/api/groups"), {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      data: { name: "Share Test Group", description: "For file sharing test" },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = (await groupRes.json()) as { id: string };

    // Add member to group
    const addMemberRes = await page.request.post(
      resolveApiUrl(`/api/groups/${group.id}/members`),
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        data: { user_id: memberMe.id, role: "member" },
      },
    );
    expect(addMemberRes.ok()).toBeTruthy();

    // Share file to group
    const shareRes = await page.request.post(
      resolveApiUrl(`/api/groups/${group.id}/files`),
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        data: {
          file_id: sharedFile!.id,
          wrapped_key: "e2e-test-wrapped-key-placeholder",
        },
      },
    );
    expect(shareRes.ok()).toBeTruthy();

    // Verify file appears in group files (owner perspective)
    const ownerGroupFiles = await page.request.get(
      resolveApiUrl(`/api/groups/${group.id}/files`),
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    expect(ownerGroupFiles.ok()).toBeTruthy();
    const ownerFiles = (await ownerGroupFiles.json()) as Array<{ filename: string }>;
    expect(ownerFiles.some((f) => f.filename === "group-shared-file.txt")).toBe(true);

    // Verify file appears in group files (member perspective)
    const memberGroupFiles = await page.request.get(
      resolveApiUrl(`/api/groups/${group.id}/files`),
      { headers: { Authorization: `Bearer ${memberToken}` } },
    );
    expect(memberGroupFiles.ok()).toBeTruthy();
    const memberFiles = (await memberGroupFiles.json()) as Array<{ filename: string }>;
    expect(memberFiles.some((f) => f.filename === "group-shared-file.txt")).toBe(true);

    // Navigate to groups page as member and verify group is visible with the file
    await page.evaluate((t) => localStorage.setItem("token", t), memberToken);
    await gotoStable(page, "/groups");
    await expect(page.getByText("Share Test Group")).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: test.info().outputPath("group-file-shared.png"),
      fullPage: true,
    });
  });

  test("removing file from group makes it inaccessible via group files endpoint", async ({ page }) => {
    const owner = buildOwnerAccount();

    await registerAccount(page, owner);
    await loginWithPassword(page, owner);
    await completeOnboarding(page, owner);
    const ownerToken = await getAuthToken(page);

    await gotoStable(page, "/files");
    await uploadFileAsOwner(page, owner, {
      name: "revocable-group-file.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This file will be unshared from group"),
    });

    const filesRes = await page.request.get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const files = (await filesRes.json()) as Array<{ id: string; filename: string }>;
    const targetFile = files.find((f) => f.filename === "revocable-group-file.txt");
    expect(targetFile).toBeTruthy();

    // Create group and share file
    const groupRes = await page.request.post(resolveApiUrl("/api/groups"), {
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      data: { name: "Revoke Group", description: "Revocation test" },
    });
    const group = (await groupRes.json()) as { id: string };

    await page.request.post(resolveApiUrl(`/api/groups/${group.id}/files`), {
      headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
      data: { file_id: targetFile!.id, wrapped_key: "e2e-revoke-test-key" },
    });

    // Verify file is in group files
    const beforeRes = await page.request.get(
      resolveApiUrl(`/api/groups/${group.id}/files`),
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    const beforeFiles = (await beforeRes.json()) as Array<{ filename: string }>;
    expect(beforeFiles.some((f) => f.filename === "revocable-group-file.txt")).toBe(true);

    // Remove file from group
    const removeRes = await page.request.delete(
      resolveApiUrl(`/api/groups/${group.id}/files/${targetFile!.id}`),
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    expect(removeRes.ok()).toBeTruthy();

    // Verify file is gone from group
    const afterRes = await page.request.get(
      resolveApiUrl(`/api/groups/${group.id}/files`),
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    const afterFiles = (await afterRes.json()) as Array<{ filename: string }>;
    expect(afterFiles.some((f) => f.filename === "revocable-group-file.txt")).toBe(false);
  });
});
