import { expect, type Page } from "@playwright/test";

const configuredBaseURL = process.env.ABRN_E2E_BASE_URL ?? "http://127.0.0.1:8090/abrn";
const appBaseURL = configuredBaseURL.endsWith("/") ? configuredBaseURL : `${configuredBaseURL}/`;
const appOrigin = new URL(appBaseURL).origin;
const configuredApiBaseURL = process.env.ABRN_E2E_API_BASE_URL ?? `${appOrigin}/api`;
const apiBaseURL = configuredApiBaseURL.endsWith("/") ? configuredApiBaseURL.slice(0, -1) : configuredApiBaseURL;

export interface OwnerAccount {
  email: string;
  password: string;
  pin: string;
  username: string;
}

export function buildOwnerAccount(): OwnerAccount {
  const stamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    email: `qa-${stamp}-${suffix}@example.com`,
    password: "Passw0rd!123",
    pin: "2468",
    username: `qa${stamp}${suffix}`,
  };
}

export async function gotoStable(page: Page, path = "/") {
  const normalizedPath = path === "/" ? "./" : `.${path}`;
  await page.goto(normalizedPath, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
}

export async function registerAccount(page: Page, account: OwnerAccount) {
  await gotoStable(page, "/login");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.locator("#register-first-name").fill("QA");
  await page.locator("#register-last-name").fill("Verifier");
  await page.locator("#register-username").fill(account.username);
  await page.locator("#register-email").fill(account.email);
  await page.locator("#register-password").fill(account.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("Welcome to ABRN Drive")).toBeVisible();
}

export async function loginWithPassword(page: Page, account: OwnerAccount) {
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(account.password);
  await page.getByRole("button", { name: "Open ABRN Drive" }).click();
  await page.waitForURL((url) => !url.toString().includes("/login"));
}

export async function completeOnboarding(page: Page, account: OwnerAccount, folderName = "QA Inbox") {
  await gotoStable(page, "/files");
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.locator("#onboarding-pin").fill(account.pin);
  await page.locator("#onboarding-confirm-pin").fill(account.pin);
  await page.locator("#onboarding-account-password").fill(account.password);
  await page.getByRole("button", { name: /^Set PIN$/i }).click();
  await page.locator("#onboarding-folder-name").fill(folderName);
  await page.getByTestId("onboarding-create-folder").click();
  await page.getByRole("button", { name: /Enter Protected Vault/i }).click();
  await expect(page.getByText("No files here yet")).toBeVisible();
}

export async function clearLocalAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  });
}

export async function loginWithPin(page: Page, account: OwnerAccount) {
  await gotoStable(page, "/login");
  await page.getByRole("button", { name: "PIN" }).click();
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-pin").fill(account.pin);
  await page.getByRole("button", { name: "Open ABRN Drive" }).click();
  await page.waitForURL((url) => !url.toString().includes("/login"));
}

async function getAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("token"));
  if (!token) {
    throw new Error("No auth token found in localStorage.");
  }
  return token;
}

function resolveAppUrl(page: Page, path: string): string {
  void page;
  return new URL(path, appBaseURL).toString();
}

function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseURL}${normalizedPath.replace(/^\/api/, "")}`;
}

export async function createUploadRoute(page: Page, account: OwnerAccount) {
  const token = await getAuthToken(page);
  const foldersResponse = await page.request.get(resolveApiUrl("/api/folders"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(foldersResponse.ok()).toBeTruthy();
  const folders = (await foldersResponse.json()) as Array<{ id: string; name: string }>;
  let folder = folders[0];
  if (!folder) {
    const createFolderResponse = await page.request.post(resolveApiUrl("/api/folders"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "QA Inbox",
      },
    });
    expect(createFolderResponse.ok()).toBeTruthy();
    folder = (await createFolderResponse.json()) as { id: string; name: string };
  }
  if (!folder) {
    throw new Error("No folder available for upload route creation.");
  }

  const response = await page.request.post(resolveApiUrl("/api/drop/create"), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      target_folder_id: folder.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      max_files: 0,
      pin: account.pin,
      link_name: "QA Intake Route",
      description: "QA secure drop route",
      seal_after_upload: false,
    },
  });
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()) as { upload_url: string };
  return new URL(data.upload_url, new URL(page.url()).origin).toString();
}

export async function createFileRequestRoute(page: Page) {
  const token = await getAuthToken(page);
  const response = await page.request.post(resolveApiUrl("/api/file-requests"), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      description: "Please upload your verification files.",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      max_file_size: 0,
    },
  });
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()) as { request_url: string };
  return new URL(data.request_url, new URL(page.url()).origin).toString();
}
