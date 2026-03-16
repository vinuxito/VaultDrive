import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  completeOnboarding,
  createFileRequestRoute,
  createUploadRoute,
  loginWithPassword,
  registerAccount,
} from "./helpers/trust";

test("secure drop sender route accepts delivery with owner context", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  const uploadUrl = await createUploadRoute(page, account);
  await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Secure File Delivery")).toBeVisible();
  await page.locator("#client-message").fill("Delivered from Playwright sender flow.");
  const uploadResponsePromise = page.waitForResponse((response) => response.url().includes("/api/drop/") && response.url().includes("/upload"));
  await page.locator("#file-input").setInputFiles({
    name: "drop-proof.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("secure drop sender proof"),
  });
  const uploadResponse = await uploadResponsePromise;
  const uploadResponseText = await uploadResponse.text();
  expect(
    uploadResponse.ok(),
    `Expected secure drop upload to succeed, got ${uploadResponse.status()} with body: ${uploadResponseText}`,
  ).toBeTruthy();

  await expect(page.getByText("Files delivered securely")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Delivery receipt")).toBeVisible();
});

test("secure drop sender route fails clearly when the fragment key is missing", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  const uploadUrl = await createUploadRoute(page, account);
  const urlWithoutKey = uploadUrl.split("#")[0] ?? uploadUrl;
  await page.goto(urlWithoutKey, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Secure File Delivery")).toBeVisible();
  await page.locator("#file-input").setInputFiles({
    name: "drop-proof.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("secure drop sender proof"),
  });

  await expect(page.getByText("Encryption key not found in URL. Please use the full link provided to you.")).toBeVisible();
});

test("file request sender flow requires passphrase and completes with receipt", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  const requestUrl = await createFileRequestRoute(page);
  await page.goto(requestUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Secure File Request")).toBeVisible();
  await page.getByPlaceholder("Enter a secure password…").fill("SenderPass!123");
  await page.locator("#file-input-req").setInputFiles({
    name: "request-proof.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("file request sender proof"),
  });
  await page.getByRole("button", { name: "Send Securely" }).click();

  await expect(page.getByText("Files sent securely")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Delivery receipt")).toBeVisible();
});
