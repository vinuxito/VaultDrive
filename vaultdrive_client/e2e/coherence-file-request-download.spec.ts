import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import {
  buildOwnerAccount,
  completeOnboarding,
  createFileRequestRoute,
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

test("private backend: owner downloads exact File Request bytes with the sender passphrase", async ({ page }) => {
  test.setTimeout(120_000);

  const account = buildOwnerAccount();
  const filename = `request-exact-${Date.now()}.txt`;
  const passphrase = "SenderPass!123";
  const plaintext = Buffer.from("ABRN File Request exact-byte proof\n", "utf8");

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account, `Request owner ${Date.now()}`);
  const authToken = await getAuthToken(page);
  const requestUrl = await createFileRequestRoute(page);

  await page.goto(requestUrl, { waitUntil: "load" });
  await expect(page.getByText("Secure File Request", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Enter a secure password…").fill(passphrase);
  await page.locator("#file-input-req").setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: plaintext,
  });
  await page.getByRole("button", { name: "Send Securely", exact: true }).click();
  await expect(page.getByText("Files sent securely", { exact: true })).toBeVisible({ timeout: 30_000 });

  const filesResponse = await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(filesResponse.ok()).toBeTruthy();
  const files = (await filesResponse.json()) as Array<{
    id: string;
    filename: string;
    metadata: string;
    pin_wrapped_key?: string | null;
  }>;
  const requestedFile = files.find((file) => file.filename === filename);
  expect(requestedFile).toBeTruthy();
  expect(requestedFile!.pin_wrapped_key).toBeNull();
  const storedMetadata = JSON.parse(requestedFile!.metadata) as { iv?: string; salt?: string };
  expect(storedMetadata).toHaveProperty("iv");
  expect(storedMetadata.salt).toBeUndefined();

  const encryptedDownloadResponse = await page.request.get(
    resolveApiUrl(`/api/files/${requestedFile!.id}/download`),
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  expect(encryptedDownloadResponse.ok()).toBeTruthy();
  const senderSalt = encryptedDownloadResponse.headers()["x-wrapped-key"];
  expect(senderSalt).toBeTruthy();
  expect(Buffer.from(senderSalt!, "base64")).toHaveLength(16);

  await page.goto("./files", { waitUntil: "load" });
  const row = page.locator('[id^="file-row-"]').filter({ hasText: filename });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByTitle("Download", { exact: true }).click();
  const credentialField = page.locator("#vault-credential");
  await expect(credentialField).toBeVisible();
  await credentialField.fill(passphrase);

  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: /Decrypt.*Download/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(filename);
  expect(await readFile((await download.path())!)).toEqual(plaintext);
});
