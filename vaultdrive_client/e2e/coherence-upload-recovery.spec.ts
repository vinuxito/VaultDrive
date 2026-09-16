import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";

import {
  buildOwnerAccount,
  completeOnboarding,
  createUploadRoute,
  getAuthToken,
  loginWithPassword,
  registerAccount,
  resolveApiUrl,
} from "./helpers/trust";

test.use({
  serviceWorkers: "block",
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
});

function dropInfo() {
  return {
    valid: true,
    folder_name: "Fixture inbox",
    link_name: "Fixture upload route",
    description: "Synthetic browser fixture",
    files_limit: 10,
    uploaded: 0,
    expires_at: null,
    has_password: false,
    owner_display_name: "Fixture Recipient",
    owner_organization: "ABRN",
    checklist_items: [],
  };
}

function dropReceipt(fileId: string) {
  return {
    success: true,
    uploaded: 1,
    count: 1,
    files: [{ file_id: fileId, file_name: `${fileId}.txt`, path: "" }],
  };
}

async function ownerFiles(page: import("@playwright/test").Page, token: string) {
  const response = await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  return await response.json() as Array<{ id: string; filename: string }>;
}

test("fixture: Drop keeps an accepted row and retries only the confirmed 429 row", async ({ page }) => {
  const dropToken = "fixture-partial-drop";
  let uploadRequests = 0;
  const uploadBodies: Buffer[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path.endsWith(`/api/drop/${dropToken}`)) {
      await route.fulfill({ json: dropInfo() });
      return;
    }
    if (request.method() === "POST" && path.endsWith(`/api/drop/${dropToken}/upload`)) {
      uploadRequests += 1;
      uploadBodies.push(request.postDataBuffer() ?? Buffer.alloc(0));
      if (uploadRequests === 2) {
        await route.fulfill({ status: 429, json: { error: "Wait before retrying" } });
      } else {
        await route.fulfill({ status: 201, json: dropReceipt(`fixture-file-${uploadRequests}`) });
      }
      return;
    }
    throw new Error(`Unexpected fixture API request: ${request.method()} ${path}`);
  });

  await page.goto(`drop/${dropToken}#key=${randomBytes(32).toString("hex")}`);
  await page.locator("#file-input").setInputFiles([
    { name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("first") },
    { name: "second.txt", mimeType: "text/plain", buffer: Buffer.from("second") },
  ]);

  await expect(page.getByText("1 accepted · 1 failed · 0 need confirmation", { exact: true })).toBeVisible();
  expect(uploadRequests).toBe(2);
  expect(uploadBodies[0].includes(Buffer.from("first.txt"))).toBeTruthy();
  expect(uploadBodies[1].includes(Buffer.from("second.txt"))).toBeTruthy();
  await page.getByRole("button", { name: "Retry confirmed failures (1)", exact: true }).click();

  await expect(page.getByText("Your files have been delivered securely.", { exact: true })).toBeVisible();
  expect(uploadRequests).toBe(3);
  expect(uploadBodies[2].includes(Buffer.from("second.txt"))).toBeTruthy();
  expect(uploadBodies[2].includes(Buffer.from("first.txt"))).toBeFalsy();
});

test("fixture: File Request keeps an ambiguous public upload independent of owner APIs", async ({ page }) => {
  const requestToken = "fixture-file-request";
  let uploadRequests = 0;
  let ownerApiRequests = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/files")) ownerApiRequests += 1;
    if (request.method() === "GET" && path.endsWith(`/api/file-requests/${requestToken}/info`)) {
      await route.fulfill({
        json: {
          description: "Synthetic browser fixture",
          expires_at: null,
          is_expired: false,
          owner_display_name: "Fixture Recipient",
          owner_organization: "ABRN",
          uploaded_count: 0,
          max_file_size: 10_000_000,
        },
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith(`/api/file-requests/${requestToken}/upload`)) {
      uploadRequests += 1;
      await route.fulfill({ status: 503, json: { error: "Fixture response lost" } });
      return;
    }
    throw new Error(`Unexpected fixture API request: ${request.method()} ${path}`);
  });

  await page.goto(`request/${requestToken}`);
  await page.getByPlaceholder("Enter a secure password…").fill("correct horse battery staple");
  await page.locator("#file-input-req").setInputFiles({
    name: "ambiguous-request.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("ambiguous request fixture"),
  });
  await page.getByRole("button", { name: "Send Securely", exact: true }).click();

  await expect(page.getByText("0 accepted · 0 failed · 1 need confirmation", { exact: true })).toBeVisible();
  await expect(page.getByText(/Do not resend files marked/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Retry confirmed failures/ })).toHaveCount(0);
  expect(uploadRequests).toBe(1);
  expect(ownerApiRequests).toBe(0);
});

test("private backend: accepted Drop upload with a lost response stays unknown and is not duplicated", async ({ page }) => {
  const account = buildOwnerAccount();
  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);
  const authToken = await getAuthToken(page);
  const beforeFiles = await ownerFiles(page, authToken);
  const uploadUrl = await createUploadRoute(page, account);
  let uploadRequests = 0;
  let backendStatus = 0;

  await page.route("**/api/drop/*/upload", async (route) => {
    uploadRequests += 1;
    const backendResponse = await route.fetch();
    backendStatus = backendResponse.status();
    await route.abort("failed");
  });

  await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#file-input").setInputFiles({
    name: "drop-lost-response.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("real private backend accepted drop"),
  });

  await expect(page.getByText("0 accepted · 0 failed · 1 need confirmation", { exact: true })).toBeVisible();
  await expect(page.getByText(/Do not resend files marked/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Retry confirmed failures/ })).toHaveCount(0);
  expect(backendStatus).toBe(201);
  expect(uploadRequests).toBe(1);

  await expect.poll(async () => (await ownerFiles(page, authToken)).length).toBe(beforeFiles.length + 1);
  await page.waitForTimeout(300);
  expect((await ownerFiles(page, authToken)).filter((file) => file.filename === "drop-lost-response.txt")).toHaveLength(1);
  expect(uploadRequests).toBe(1);
});

test("private backend: accepted owner upload with a lost response refreshes inventory without false completion", async ({ page }) => {
  const account = buildOwnerAccount();
  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);
  const authToken = await getAuthToken(page);
  const beforeFiles = await ownerFiles(page, authToken);
  let uploadRequests = 0;
  let fileListRequests = 0;
  let backendStatus = 0;

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path.endsWith("/api/files")) fileListRequests += 1;
  });
  await page.route("**/api/files/upload", async (route) => {
    uploadRequests += 1;
    const backendResponse = await route.fetch();
    backendStatus = backendResponse.status();
    await route.abort("failed");
  });

  const fileListRequestsBeforeUpload = fileListRequests;
  await page.locator("#file-input").setInputFiles({
    name: "owner-lost-response.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("real private backend accepted owner upload"),
  });
  await page.locator("button", { hasText: /Encrypt & Upload/i }).first().click();
  const pinField = page.locator("#vault-credential");
  if (await pinField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pinField.fill(account.pin);
    await page.locator("button", { hasText: /Encrypt & Upload/i }).last().click();
  }

  await expect(page.getByText(/connection ended after the upload started/i).first()).toBeVisible();
  await expect(page.getByText("?", { exact: true })).toBeVisible();
  expect(backendStatus).toBe(201);
  expect(uploadRequests).toBe(1);
  await expect.poll(() => fileListRequests).toBeGreaterThan(fileListRequestsBeforeUpload);
  await expect.poll(async () => (await ownerFiles(page, authToken)).length).toBe(beforeFiles.length + 1);
  await page.waitForTimeout(300);
  expect((await ownerFiles(page, authToken)).filter((file) => file.filename === "owner-lost-response.txt")).toHaveLength(1);
  expect(uploadRequests).toBe(1);
});
