import { expect, test } from "@playwright/test";
import { createCipheriv, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

test.use({
  serviceWorkers: "block",
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
});

const token = "coherence-public-transfer";
const filename = "coherence-proof.txt";
const plaintext = Buffer.from("ABRN Drive public transfer browser proof\n");

function encrypt(key: Buffer, iv: Buffer, data: Buffer) {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);
}

function shareInfo(maxDownloads?: number) {
  return {
    filename,
    file_size: plaintext.length,
    expires_at: null,
    is_expired: false,
    owner_display_name: "Fixture Owner",
    owner_organization: "ABRN",
    access_count: 0,
    ...(maxDownloads === undefined ? {} : { max_downloads: maxDownloads }),
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
});

test("recovers from an initial 503 and downloads the decrypted bytes", async ({ page }) => {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  let infoRequests = 0;

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/api/share/${token}/info`)) {
      infoRequests += 1;
      if (infoRequests === 1) {
        await route.fulfill({ status: 503, json: { error: "fixture unavailable" } });
      } else {
        await route.fulfill({ json: shareInfo() });
      }
      return;
    }
    if (path.endsWith(`/api/share/${token}`)) {
      await route.fulfill({
        status: 200,
        body: encrypt(key, iv, plaintext),
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Name": filename,
          "X-File-Metadata": JSON.stringify({ iv: iv.toString("base64") }),
        },
      });
      return;
    }
    throw new Error(`Unexpected API request: ${path}`);
  });

  await page.goto(`share/${token}#${key.toString("base64")}`);
  await expect(page.getByText("The service is temporarily unavailable.", { exact: true })).toBeVisible();
  await expect(page.getByText(/complete share link|key after #/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download File", exact: true })).toBeVisible();

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download File", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(filename);
  expect(await readFile((await download.path())!)).toEqual(plaintext);
  await expect(page.getByText("Browser save started", { exact: true })).toBeVisible();
  expect(infoRequests).toBe(2);
});

test("keeps a missing fragment distinct and does not offer a generic retry", async ({ page }) => {
  let apiRequests = 0;
  await page.route("**/api/**", async (route) => {
    apiRequests += 1;
    await route.abort("failed");
  });

  await page.goto(`share/${token}`);
  await expect(page.getByText(/share link is incomplete/i)).toBeVisible();
  await expect(page.getByText(/key after #/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
  expect(apiRequests).toBe(0);
});

test("does not automatically repeat a failed authorized one-use fetch", async ({ page }) => {
  const key = randomBytes(32);
  let downloadRequests = 0;

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/api/share/${token}/info`)) {
      await route.fulfill({ json: shareInfo(1) });
      return;
    }
    if (path.endsWith(`/api/share/${token}`)) {
      downloadRequests += 1;
      await route.fulfill({ status: 503, json: { error: "fixture unavailable" } });
      return;
    }
    throw new Error(`Unexpected API request: ${path}`);
  });

  await page.goto(`share/${token}#${key.toString("base64")}`);
  await expect(page.getByText(/consumed when the authorized file fetch starts/i)).toBeVisible();
  await page.getByRole("button", { name: "Download File", exact: true }).click();
  await expect(page.getByText("The service is temporarily unavailable.", { exact: true })).toBeVisible();
  await expect(page.getByText(/authorized fetch may have consumed the one-time link/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  expect(downloadRequests).toBe(1);
});
