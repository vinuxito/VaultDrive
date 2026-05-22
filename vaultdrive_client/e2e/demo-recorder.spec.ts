import { test, expect } from "@playwright/test";
import {
  buildOwnerAccount,
  registerAccount,
  loginWithPassword,
  gotoStable,
  productName
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

  // Upload file
  const testFile = path.resolve("e2e", "test-files", "demo-file.txt");
  await page.setInputFiles('input[type="file"]', testFile);
  
  // Wait for the upload to complete and file card to appear
  await expect(page.getByText("demo-file.txt").first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000); // Admire the encrypted file

  // -----------------------------------------------------
  // Beat 3: The Share
  // -----------------------------------------------------
  // The share button is inside the MoreMenu dropdown
  // We locate the file card and click its last button (the MoreMenu trigger)
  const fileCard = page.getByText("demo-file.txt").first().locator('xpath=./ancestor::div[contains(@class, "group")]');
  await fileCard.locator('button').last().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Share Link/i }).click();
  await page.waitForTimeout(1000); // Look at the dialog
  
  // Copy link
  await page.getByRole("button", { name: "Copy Link" }).click();
  const clipboardText = await page.evaluate("navigator.clipboard.readText()");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Close|Done/i }).click();
  
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
  // Actually, we'll just scroll down to Audit Logs
  await page.getByRole("heading", { name: "Audit log" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  // Show that the file upload and share link creation are tracked
  await expect(page.getByText("file.uploaded").first()).toBeVisible();
  await expect(page.getByText("file.shared").first()).toBeVisible();
  
  // -----------------------------------------------------
  // Beat 5: The Close (Themes & Languages)
  // -----------------------------------------------------
  // Theme Toggle
  const themeToggle = page.locator('button[aria-label="Toggle theme"], button[title="Switch theme"], [data-testid="theme-toggle"]');
  // If we can't find it easily by role, let's look for a generic button with 'theme'
  // Or just click the avatar/menu to find languages
  await page.getByRole("button", { name: "Account settings" }).click(); // The avatar dropdown
  await page.waitForTimeout(1000);
  await page.getByRole("menuitem", { name: "Theme" }).hover();
  await page.waitForTimeout(1000);
  await page.getByText("Cyberpunk").click();
  await page.waitForTimeout(1500); // Admire Cyberpunk

  await page.getByRole("button", { name: "Account settings" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("menuitem", { name: "Language" }).hover();
  await page.waitForTimeout(500);
  await page.getByText("Español").click();
  await page.waitForTimeout(2000); // Admire Spanish UI

  // End of Demo
});
