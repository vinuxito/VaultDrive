import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  buildOwnerAccount,
  clearLocalAuth,
  completeOnboarding,
  createUploadRoute,
  gotoStable,
  loginWithPassword,
  registerAccount,
} from "./helpers/trust";

test.describe("Secure Drop owner preview", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("recovers from a wrong PIN and downloads the exact ZIP bytes after the correct PIN", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const account = buildOwnerAccount();
    const filename = `drop-preview-${Date.now()}.zip`;
    const plaintext = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("ABRN secure drop preview regression\n", "utf8"),
      Buffer.from([0x00, 0xff, 0x7f, 0x80]),
    ]);

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);
    const uploadUrl = await createUploadRoute(page, account);

    await clearLocalAuth(page);
    await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Secure File Delivery")).toBeVisible();

    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/drop/") &&
        response.url().includes("/upload"),
    );
    await page.locator("#file-input").setInputFiles({
      name: filename,
      mimeType: "application/zip",
      buffer: plaintext,
    });
    const uploadResponse = await uploadResponsePromise;
    expect(
      uploadResponse.ok(),
      `Anonymous Drop upload failed: ${uploadResponse.status()} — ${await uploadResponse.text()}`,
    ).toBeTruthy();
    await expect(
      page.getByText("Your files have been delivered securely."),
    ).toBeVisible({ timeout: 30_000 });

    await gotoStable(page, "/login");
    await loginWithPassword(page, account);
    await gotoStable(page, "/files");

    const fileRow = page.locator('[id^="file-row-"]', {
      has: page.getByText(filename, { exact: true }),
    });
    await expect(fileRow).toBeVisible({ timeout: 15_000 });
    await fileRow.getByText(filename, { exact: true }).click();

    const credentialInput = page.locator("#preview-credential");
    await expect(credentialInput).toBeVisible();
    await credentialInput.fill("0000");
    await page.getByRole("button", { name: "Decrypt & Preview", exact: true }).click();

    await expect(page.getByText(/decryption failed/i)).toBeVisible();
    await expect(credentialInput).toBeVisible();
    await expect(credentialInput).toBeEditable();

    await credentialInput.fill(account.pin);
    await page.getByRole("button", { name: "Decrypt & Preview", exact: true }).click();
    await expect(page.getByText("Preview not available for this file type")).toBeVisible({
      timeout: 30_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).last().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(filename);
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    expect(await readFile(downloadedPath!)).toEqual(plaintext);
  });
});
