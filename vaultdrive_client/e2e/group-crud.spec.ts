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

test.describe("Group CRUD operations", () => {
  test("create group via UI, verify it appears in the groups list", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/groups");

    // Empty state should show
    await expect(page.getByText("No groups yet")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Create your first group")).toBeVisible();

    // Click the "+" button to open create modal
    await page.locator("button").filter({ has: page.locator("svg.lucide-plus") }).click();

    // Fill group creation form
    await page.locator("#name").fill("QA Engineering Team");
    await page.locator("#description").fill("Automated test group for E2E verification");

    // Submit
    await page.getByRole("button", { name: /^Create Group$/i }).click();

    // Verify group appears in the list
    await expect(page.getByText("QA Engineering Team")).toBeVisible({ timeout: 5000 });
    // Owner is automatically a member, so count is at least 1
    await expect(page.getByText(/\d+ members?/)).toBeVisible();

    await page.screenshot({
      path: test.info().outputPath("group-created.png"),
      fullPage: true,
    });
  });

  test("add and remove members from group via API", async ({ page }) => {
    const owner = buildOwnerAccount();
    const member = buildOwnerAccount();

    // Register both accounts
    await registerAccount(page, owner);
    await loginWithPassword(page, owner);
    await completeOnboarding(page, owner);

    // Register second user in a separate context
    const ownerToken = await getAuthToken(page);

    // Register member via API (navigate to login, register, come back)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await registerAccount(page, member);
    await loginWithPassword(page, member);
    const memberToken = await getAuthToken(page);

    // Get member user ID
    const memberMeRes = await page.request.get(resolveApiUrl("/api/users/me"), {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const memberMe = (await memberMeRes.json()) as { id: string };

    // Switch back to owner
    await page.evaluate((t) => localStorage.setItem("token", t), ownerToken);

    // Create group via API
    const createRes = await page.request.post(resolveApiUrl("/api/groups"), {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      data: { name: "Member Test Group", description: "Testing add/remove" },
    });
    expect(createRes.ok()).toBeTruthy();
    const group = (await createRes.json()) as { id: string };

    // Add member
    const addRes = await page.request.post(
      resolveApiUrl(`/api/groups/${group.id}/members`),
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json",
        },
        data: { user_id: memberMe.id, role: "member" },
      },
    );
    expect(addRes.ok()).toBeTruthy();

    // Verify member is listed
    const membersRes = await page.request.get(
      resolveApiUrl(`/api/groups/${group.id}/members`),
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    expect(membersRes.ok()).toBeTruthy();
    const members = (await membersRes.json()) as Array<{ user_id: string }>;
    expect(members.some((m) => m.user_id === memberMe.id)).toBe(true);

    // Remove member
    const removeRes = await page.request.delete(
      resolveApiUrl(`/api/groups/${group.id}/members/${memberMe.id}`),
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    expect(removeRes.ok()).toBeTruthy();

    // Verify member is gone
    const members2Res = await page.request.get(
      resolveApiUrl(`/api/groups/${group.id}/members`),
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    const members2 = (await members2Res.json()) as Array<{ user_id: string }>;
    expect(members2.some((m) => m.user_id === memberMe.id)).toBe(false);
  });

  test("delete group removes it from the list", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    const token = await getAuthToken(page);

    // Create group via API
    const createRes = await page.request.post(resolveApiUrl("/api/groups"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: { name: "Deletable Group", description: "Will be deleted" },
    });
    expect(createRes.ok()).toBeTruthy();
    const group = (await createRes.json()) as { id: string };

    // Navigate to groups page — group should be visible
    await gotoStable(page, "/groups");
    await expect(page.getByText("Deletable Group")).toBeVisible({ timeout: 5000 });

    // Delete via API
    const deleteRes = await page.request.delete(resolveApiUrl(`/api/groups/${group.id}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.ok()).toBeTruthy();

    // Refresh and verify it's gone
    await gotoStable(page, "/groups");
    await expect(page.getByText("Deletable Group")).not.toBeVisible({ timeout: 5000 });
  });
});
