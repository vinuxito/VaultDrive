import { test, expect } from "@playwright/test";
import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

// Synthetic account/API responses only; browser crypto and downloads are real.
test.use({
  serviceWorkers: "block",
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
});
test.setTimeout(45_000);
const pin = "4321";
const plaintext = Buffer.from("ABRN Drive PIN download regression\n");

function encrypt(key: Buffer, iv: Buffer, data: Buffer) {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);
}

for (const wrappedKey of [true, false]) {
for (const bulk of [true, false]) {
test(`autofill and PIN retry: ${bulk ? "bulk" : "single"} ${wrappedKey ? "drop" : "owner"} download`, async ({ page }) => {
  const iv = randomBytes(12);
  const salt = randomBytes(16);
  const key = wrappedKey ? randomBytes(32) : pbkdf2Sync(pin, salt, 100000, 32, "sha256");
  const wrapIv = randomBytes(12);
  const wrapped = Buffer.concat([
    salt, wrapIv,
    encrypt(pbkdf2Sync(pin, salt, 100000, 32, "sha256"), wrapIv, Buffer.from(key.toString("hex"))),
  ]).toString("hex");
  const metadata = JSON.stringify({ iv: iv.toString("base64"), salt: wrappedKey ? "" : salt.toString("base64"), credential_scheme: "pin" });
  const file = {
    id: "autofill-regression", filename: "pin-download.txt", metadata,
    pin_wrapped_key: wrappedKey ? wrapped : null, is_owner: true, file_size: plaintext.length,
    created_at: "2026-09-14T00:00:00Z",
  };
  await page.addInitScript(() => {
    localStorage.setItem("token", `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.fixture`);
    localStorage.setItem("user", JSON.stringify({
      id: "synthetic-user", email: "fixture@example.test", username: "Fixture",
      pin_set: true, is_admin: false,
    }));
    localStorage.setItem("i18nextLng", "en");
  });
  const downloadRequests: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/files/${file.id}/download`)) {
      downloadRequests.push(path);
      await route.fulfill({
        status: 200, body: encrypt(key, iv, plaintext),
        headers: { "Content-Type": "application/octet-stream", "X-File-Metadata": metadata, ...(wrappedKey ? { "X-Wrapped-Key": wrapped } : {}) },
      });
      return;
    }
    await route.fulfill({ json: path.endsWith("/api/files") ? [file] : [] });
  });
  await page.goto("files");
  if (bulk) {
    await page.locator(`#file-row-${file.id}`).getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Download 1$/ }).click();
    await expect(page.getByText("Download 1 file", { exact: true })).toBeVisible();
  } else {
    await page.locator(`#file-row-${file.id}`).getByTitle("Download", { exact: true }).click();
  }

  // Reproduce the password-manager input event from the screenshots, even if
  // the browser bypasses autocomplete hints or the field is disabled.
  const search = page.getByPlaceholder(/search.*files/i);
  await search.evaluate((element) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(element, "fixture@example.test");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  if (bulk) await expect(page.getByText("Download 1 file", { exact: true })).toBeVisible();
  const pinInput = page.locator(bulk ? "#bulk-download-pin" : "#vault-credential");
  const start = page.getByRole("button", { name: bulk ? /Start Download|Retry Downloads/i : /Decrypt.*Download/i });
  await expect(pinInput).toBeVisible();
  await expect(start).toBeDisabled();
  await expect(search).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath("pin-prompt.png") });
  if (!wrappedKey) {
    await pinInput.fill("0000");
    await start.click();
    await expect(page.getByRole("dialog").getByText("Incorrect PIN or file credential. Please try again.")).toBeVisible();
    await expect(pinInput).toHaveValue("");
  }
  await pinInput.fill(pin);
  const downloadEvent = page.waitForEvent("download", { timeout: 10_000 });
  await start.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(file.filename);
  expect(await readFile((await download.path())!)).toEqual(plaintext);
  expect(downloadRequests).toHaveLength(wrappedKey ? 1 : 2);
  if (bulk) await page.getByRole("button", { name: "Done", exact: true }).click();
  else await expect(pinInput).toHaveCount(0);
  expect(downloadRequests).toHaveLength(wrappedKey ? 1 : 2);
  await expect(search).toHaveValue("");
  await expect(page.locator(`#file-row-${file.id}`)).toBeVisible();
  await search.fill("missing-file-name");
  await expect(page.locator(`#file-row-${file.id}`)).toHaveCount(0);
  await search.fill("");
  await expect(page.locator(`#file-row-${file.id}`)).toBeVisible();
});
}
}
