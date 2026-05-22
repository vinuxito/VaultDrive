import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  gotoStable,
  productName,
  uploadFileAsOwner
} from "./helpers/trust";
import path from "path";

const apiBase = process.env.E2E_API_BASE_URL ?? `${new URL(process.env.E2E_BASE_URL ?? `http://127.0.0.1:8090${process.env.VITE_BASE_PATH ?? "/quantix"}/`).href}api`;
function apiUrl(path: string): string {
  const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

test.use({
  video: "on",
  viewport: { width: 1920, height: 1080 },
});

test("Hackathon 60-second Golden Path", async ({ page, request, context }) => {
  const account = buildOwnerAccount();

  // -----------------------------------------------------
  // Beat 1: The Hook (Landing page & Register)
  // -----------------------------------------------------
  await gotoStable(page, "/login");
  await page.waitForTimeout(1000);
  
  // Register an account silently for the demo context to exist
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.locator("#register-first-name").fill("QA");
  await page.locator("#register-last-name").fill("Verifier");
  await page.locator("#register-username").fill(account.username);
  await page.locator("#register-email").fill(account.email);
  await page.locator("#register-password").fill(account.password);
  await page.waitForTimeout(1000); // Visual pause
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("button", { name: `Open ${productName}` })).toBeVisible();

  // -----------------------------------------------------
  // Beat 2: The Vault (Login, PIN, Upload, Proof)
  // -----------------------------------------------------
  await loginWithPassword(page, account);
  
  // Onboarding (PIN)
  await gotoStable(page, "/files");
  await page.getByText("What stays private").waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000); // Visual pause to read
  const continueBtn = page.getByRole("button", { name: /Continue/i });
  await continueBtn.click();

  await page.locator("#onboarding-pin").waitFor({ state: 'visible', timeout: 10000 });
  await page.locator("#onboarding-pin").fill(account.pin);
  await page.locator("#onboarding-confirm-pin").fill(account.pin);
  await page.locator("#onboarding-account-password").fill(account.password);
  await page.waitForTimeout(1000); // Visual pause

  const setPinBtn = page.getByRole("button", { name: /Set PIN/i });
  await setPinBtn.click();

  await page.locator("#onboarding-folder-name").waitFor({ state: 'visible', timeout: 30000 });
  await page.locator("#onboarding-folder-name").fill("Hackathon Files");
  await page.waitForTimeout(500);
  
  const createFolderBtn = page.getByTestId("onboarding-create-folder");
  await createFolderBtn.click();
  
  const enterVaultBtn = page.getByRole("button", { name: /Enter Protected Vault/i });
  await enterVaultBtn.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);
  await enterVaultBtn.click();
  
  await expect(page.getByText("No files here yet")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  // Upload file using the reliable helper
  await uploadFileAsOwner(page, account, {
    name: "demo-file.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Hello World, this is a secure upload demonstration for QuantiX."),
  });
  
  // Wait for the upload to complete and file row to appear
  await expect(page.locator('div.group', { hasText: 'demo-file.txt' }).first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000); // Admire the encrypted file

  // -----------------------------------------------------
  // Beat 3: The Share
  // -----------------------------------------------------
  // The share button is directly in the file row actions
  await page.getByTitle('Create share link').first().click();
  await page.waitForTimeout(1000); // Look at the dialog
  
  // Generate the link
  await page.getByRole("button", { name: "Generate Link" }).click();
  await page.waitForTimeout(1000); // Wait for the network request and animation
  
  // Copy link
  await page.getByRole("button", { name: "Copy Link" }).click();
  const clipboardText = await page.locator('#csl-share-url').inputValue();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  
  // Incognito view simulation (New context)
  const incognitoContext = await page.context().browser()!.newContext();
  const incognitoPage = await incognitoContext.newPage();
  await incognitoPage.goto(clipboardText as string);
  await expect(incognitoPage.getByText("demo-file.txt")).toBeVisible();
  // Download it to prove decryption
  await incognitoPage.getByRole("button", { name: "Download" }).click();
  await incognitoPage.waitForTimeout(1500);
  await incognitoContext.close();

  // -----------------------------------------------------
  // Beat 4: The Proof (Audit & Agent API)
  // -----------------------------------------------------
  await gotoStable(page, "/settings");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.waitForTimeout(1000);

  // Agent API Key
  // Instead of UI clicking through complex forms, we can intercept or just show the audit log
  // Actually, we'll expand the Audit Logs section
  await page.getByRole("button", { name: /Raw audit log/i }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Raw audit log/i }).click();
  await page.waitForTimeout(1500);
  // Show that the file upload and share link creation are tracked
  await expect(page.getByText("File uploaded").first()).toBeVisible();
  await expect(page.getByText("Share link created").first()).toBeVisible();
  
  // -----------------------------------------------------
  // Beat 5: The Close (Themes & Languages)
  // -----------------------------------------------------
  // Go to Account tab
  await page.getByRole("tab", { name: "Account" }).click();
  await page.waitForTimeout(500);

  // Click Cyberpunk theme
  await page.getByText("Cyberpunk").click();
  await page.waitForTimeout(1500); // Admire Cyberpunk

  // Change language to Spanish
  await page.locator('select').selectOption('es');
  await page.waitForTimeout(2000); // Admire Spanish UI

  // End of Demo

  // End of Demo
});
