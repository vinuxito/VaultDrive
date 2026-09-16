import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

import {
  buildOwnerAccount,
  completeOnboarding,
  getAuthToken,
  loginWithPassword,
  registerAccount,
  resolveApiUrl,
  uploadFileAsOwner,
} from "./helpers/trust";

test.use({
  serviceWorkers: "block",
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
});

test("private backend: owner recovers a PIN-gated full folder link and recipient downloads exact ZIP bytes", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(120_000);

  const account = buildOwnerAccount();
  const folderName = `Folder proof ${Date.now()}`;
  const filename = "exact-folder-payload.txt";
  const plaintext = Buffer.from("ABRN folder share exact-byte proof\nsecond line\n", "utf8");
  const pageErrors: string[] = [];
  const folderShareResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("share-link") || response.url().includes("access-keys-batch") || response.url().includes("files-recursive")) {
      folderShareResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account, folderName);
  const authToken = await getAuthToken(page);
  const foldersResponse = await page.request.get(resolveApiUrl("/api/folders"), {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(foldersResponse.ok()).toBeTruthy();
  const folders = (await foldersResponse.json()) as Array<{ id: string; name: string }>;
  const folder = folders.find((candidate) => candidate.name === folderName);
  expect(folder).toBeTruthy();

  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: `Navigate to ${folderName}`, exact: true }).click();
  await uploadFileAsOwner(page, account, {
    name: filename,
    mimeType: "text/plain",
    buffer: plaintext,
  });
  await expect(page.getByText(filename, { exact: true })).toBeVisible();

  const filesResponse = await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(filesResponse.ok()).toBeTruthy();
  const files = (await filesResponse.json()) as Array<{ filename: string; folder_id: string | null }>;
  expect(files.find((file) => file.filename === filename)?.folder_id).toBe(folder!.id);

  await page.evaluate(() => sessionStorage.removeItem("vault_cached_credential"));
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: `Navigate to ${folderName}`, exact: true }).click();
  await page.getByRole("button", { name: `Folder actions for ${folderName}`, exact: true }).click();
  await page.getByRole("button", { name: "Share Folder", exact: true }).click();

  await expect(page.locator("#fsl-pin")).toBeVisible();
  await page.locator("#fsl-pin").fill(account.pin);
  await page.getByRole("button", { name: "Generate Link", exact: true }).click();
  await expect(
    page.getByText("Folder share link created", { exact: true }),
    `pageErrors=${JSON.stringify(pageErrors)} responses=${JSON.stringify(folderShareResponses)}`,
  ).toBeVisible({ timeout: 30_000 });
  const createdUrl = await page.locator("#fsl-share-url").inputValue();
  expect(createdUrl).toContain("/abrn/folder-share/");
  expect(new URL(createdUrl).hash.length).toBeGreaterThan(20);
  await page.locator("button").filter({ hasText: /^Close$/ }).click();

  const linksAfterCreateResponse = await page.request.get(
    resolveApiUrl(`/api/folders/${folder!.id}/share-links`),
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  expect(linksAfterCreateResponse.ok()).toBeTruthy();
  const linksAfterCreate = (await linksAfterCreateResponse.json()) as Array<{ id: string; token: string }>;
  expect(linksAfterCreate).toHaveLength(1);

  await page.evaluate(() => sessionStorage.removeItem("vault_cached_credential"));
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: `Navigate to ${folderName}`, exact: true }).click();
  await page.getByRole("button", { name: `Folder actions for ${folderName}`, exact: true }).click();
  await page.getByRole("button", { name: "Manage Shared Links", exact: true }).click();
  await expect(page.getByText("Owner-recoverable", { exact: true })).toBeVisible();

  const appOrigin = new URL(page.url()).origin;
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: appOrigin });
  await page.evaluate(() => navigator.clipboard.writeText("unchanged-before-valid-pin"));
  await page.getByRole("button", { name: "Copy full folder share link", exact: true }).click();
  const recoveryPin = page.getByRole("textbox", { name: "4-digit PIN", exact: true });
  await recoveryPin.fill("0000");
  await page.getByRole("button", { name: "Verify PIN and copy", exact: true }).click();
  await expect(page.getByText("That PIN did not unlock your account key. Check your PIN and try again.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("unchanged-before-valid-pin");

  const linksAfterWrongPinResponse = await page.request.get(
    resolveApiUrl(`/api/folders/${folder!.id}/share-links`),
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  expect(linksAfterWrongPinResponse.ok()).toBeTruthy();
  expect((await linksAfterWrongPinResponse.json()) as unknown[]).toHaveLength(1);

  await recoveryPin.fill(account.pin);
  await expect(recoveryPin).toHaveValue(account.pin);
  await page.getByRole("button", { name: "Verify PIN and copy", exact: true }).click();
  await expect(page.locator('p[role="status"]').filter({ hasText: "Copied!" })).toHaveText("Copied!");
  const recoveredUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(recoveredUrl).toBe(createdUrl);

  const recipientContext = await browser.newContext({ acceptDownloads: true });
  const recipientPage = await recipientContext.newPage();
  try {
    await recipientPage.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
    await recipientPage.goto(recoveredUrl, { waitUntil: "load" });
    await expect(recipientPage.getByText(filename, { exact: true })).toBeVisible({ timeout: 30_000 });

    const downloadPromise = recipientPage.waitForEvent("download");
    await recipientPage.getByRole("button", { name: "Download All as ZIP", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${folderName}.zip`);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const archive = await JSZip.loadAsync(await readFile(downloadPath!));
    const entries = Object.keys(archive.files).filter((entry) => !archive.files[entry]?.dir);
    expect(entries).toEqual([`${folderName}/${filename}`]);
    const downloadedBytes = await archive.file(entries[0]!)!.async("nodebuffer");
    expect(downloadedBytes).toEqual(plaintext);
    await expect(recipientPage.getByText("Browser save started", { exact: true })).toBeVisible();
  } finally {
    await recipientContext.close();
  }
});
