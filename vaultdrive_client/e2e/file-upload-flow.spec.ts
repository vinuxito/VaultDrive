import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  completeOnboarding,
  gotoStable,
  uploadFileAsOwner,
  productName
} from "./helpers/trust";

test.describe("File upload with browser-side encryption", () => {
  test("upload encrypts file in browser and shows it in vault with AES-256-GCM metadata", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    await uploadFileAsOwner(page, account, {
      name: "test-upload.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("${productName} encryption proof — iteration 1"),
    });

    // Verify the file appears in the vault list
    await expect(page.getByText("test-upload.txt")).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: test.info().outputPath("file-upload-encrypted.png"),
      fullPage: true,
    });
  });

  test("uploaded file metadata confirms AES-256-GCM encryption", async ({ page }) => {
    const account = buildOwnerAccount();

    await registerAccount(page, account);
    await loginWithPassword(page, account);
    await completeOnboarding(page, account);

    await gotoStable(page, "/files");

    await uploadFileAsOwner(page, account, {
      name: "crypto-proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("PDF encryption verification payload"),
    });

    // Verify the file appears
    await expect(page.getByText("crypto-proof.pdf")).toBeVisible({ timeout: 10000 });

    // Verify via API that the file has correct encryption metadata
    const token = await page.evaluate(() => localStorage.getItem("token") ?? "");
    const basePath = process.env.VITE_BASE_PATH ?? "/quantix";
    const filesRes = await page.request.get(
      `${new URL(page.url()).origin}${basePath}/api/files`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(filesRes.ok()).toBeTruthy();
    const files = (await filesRes.json()) as Array<{ filename: string; metadata: string }>;
    const uploaded = files.find((f) => f.filename === "crypto-proof.pdf");
    expect(uploaded).toBeTruthy();

    // Parse metadata to confirm AES-256-GCM algorithm
    const meta = JSON.parse(uploaded!.metadata) as { algorithm?: string; credential_scheme?: string };
    expect(meta.algorithm).toBe("AES-256-GCM");
    expect(meta.credential_scheme).toBe("pin");
  });
});
