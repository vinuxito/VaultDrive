import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildOwnerAccount,
  completeOnboarding,
  createFileRequestRoute,
  createUploadRoute,
  getAuthToken,
  loginWithPassword,
  registerAccount,
  resolveApiUrl,
} from "./helpers/trust";

function createNestedUploadFixture(prefix: string) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  fs.mkdirSync(path.join(rootDir, "nested"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, "top.txt"), `${prefix} top file`);
  fs.writeFileSync(path.join(rootDir, "nested", "deep.txt"), `${prefix} deep file`);
  return rootDir;
}

type VirtualFolderFile = {
  path: string;
  content: string;
};

type FolderData = {
  id: string;
  name: string;
  parentId: string;
};

type OwnerFileData = {
  id: string;
  filename: string;
  folder_id?: string | null;
};

function findFolder(folders: FolderData[], name: string, parentId: string) {
  return folders.find((folder) => folder.name === name && folder.parentId === parentId);
}

async function dropVirtualFolder(
  page: import("@playwright/test").Page,
  files: VirtualFolderFile[],
) {
  const dropTarget = page
    .locator("label")
    .filter({ hasText: "Drag & drop files or folders here" })
    .first();

  await dropTarget.evaluate((element, folderFiles: VirtualFolderFile[]) => {
    type MockFileEntry = {
      isFile: true;
      isDirectory: false;
      name: string;
      file: (callback: (file: File) => void) => void;
    };

    type MockDirectoryEntry = {
      isFile: false;
      isDirectory: true;
      name: string;
      createReader: () => {
        readEntries: (callback: (entries: Array<MockFileEntry | MockDirectoryEntry>) => void) => void;
      };
    };

    function createFileEntry(name: string, content: string): MockFileEntry {
      return {
        isFile: true,
        isDirectory: false,
        name,
        file(callback) {
          setTimeout(() => callback(new File([content], name, { type: "text/plain" })), 0);
        },
      };
    }

    function createDirectoryEntry(
      name: string,
      entries: Array<MockFileEntry | MockDirectoryEntry>,
    ): MockDirectoryEntry {
      let emitted = false;

      return {
        isFile: false,
        isDirectory: true,
        name,
        createReader() {
          return {
            readEntries(callback) {
              setTimeout(() => {
                if (emitted) {
                  callback([]);
                  return;
                }
                emitted = true;
                callback(entries);
              }, 0);
            },
          };
        },
      };
    }

    type TreeNode = {
      files: Array<{ name: string; content: string }>;
      dirs: Map<string, TreeNode>;
    };

    const root: TreeNode = { files: [], dirs: new Map() };

    for (const file of folderFiles) {
      const parts = file.path.split("/");
      let node = root;
      for (const segment of parts.slice(0, -1)) {
        if (!node.dirs.has(segment)) {
          node.dirs.set(segment, { files: [], dirs: new Map() });
        }
        node = node.dirs.get(segment)!;
      }
      node.files.push({ name: parts[parts.length - 1]!, content: file.content });
    }

    function buildEntries(node: TreeNode): Array<MockFileEntry | MockDirectoryEntry> {
      const fileEntries = node.files.map((file) => createFileEntry(file.name, file.content));
      const dirEntries = Array.from(node.dirs.entries()).map(([name, child]) =>
        createDirectoryEntry(name, buildEntries(child)),
      );
      return [...fileEntries, ...dirEntries];
    }

    const [rootName, rootNode] = Array.from(root.dirs.entries())[0]!;
    const rootEntry = createDirectoryEntry(rootName, buildEntries(rootNode));
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { items: [{ webkitGetAsEntry: () => rootEntry }] },
    });
    element.dispatchEvent(dropEvent);
  }, files);
}

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

  await expect(page.getByText("Your files have been delivered securely.")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Delivery receipt")).toBeVisible();
});

test("secure drop folder upload preserves nested relative paths", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  const uploadUrl = await createUploadRoute(page, account);
  const token = await getAuthToken(page);
  const beforeFiles = (await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json())) as OwnerFileData[];
  const targetFolders = (await page.request.get(resolveApiUrl("/api/folders"), {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json())) as FolderData[];
  const targetFolder = targetFolders[0]!;

  const folderFixture = createNestedUploadFixture("drop-folder-proof");

  await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Secure File Delivery")).toBeVisible();
  await page.locator("#folder-input").setInputFiles(folderFixture);
  await expect(page.getByText("Your files have been delivered securely.")).toBeVisible({ timeout: 30000 });

  const filesResponse = await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(filesResponse.ok()).toBeTruthy();
  const files = (await filesResponse.json()) as OwnerFileData[];
  const folders = (await page.request.get(resolveApiUrl("/api/folders"), {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json())) as FolderData[];
  const newFiles = files.filter((file) => !beforeFiles.some((before) => before.id === file.id));
  const rootFolder = findFolder(folders, path.basename(folderFixture), targetFolder.id);
  expect(rootFolder).toBeTruthy();
  const nestedFolder = findFolder(folders, "nested", rootFolder!.id);
  expect(nestedFolder).toBeTruthy();
  expect(newFiles.some((file) => file.filename === "top.txt" && file.folder_id === rootFolder!.id)).toBeTruthy();
  expect(newFiles.some((file) => file.filename === "deep.txt" && file.folder_id === nestedFolder!.id)).toBeTruthy();
});

test("secure drop drag-and-drop folder upload preserves nested relative paths", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  const uploadUrl = await createUploadRoute(page, account);
  const token = await getAuthToken(page);
  const beforeFiles = (await page.request
    .get(resolveApiUrl("/api/files"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((response) => response.json())) as OwnerFileData[];
  const targetFolders = (await page.request.get(resolveApiUrl("/api/folders"), {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json())) as FolderData[];
  const targetFolder = targetFolders[0]!;

  const rootName = `drop-dnd-proof-${Date.now()}`;

  await page.goto(uploadUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Secure File Delivery")).toBeVisible();

  await dropVirtualFolder(page, [
    { path: `${rootName}/top.txt`, content: "drop dnd top" },
    { path: `${rootName}/nested/deep.txt`, content: "drop dnd deep" },
  ]);

  await expect(page.getByText("Your files have been delivered securely.")).toBeVisible({ timeout: 30000 });

  const filesResponse = await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(filesResponse.ok()).toBeTruthy();
  const files = (await filesResponse.json()) as OwnerFileData[];
  const folders = (await page.request.get(resolveApiUrl("/api/folders"), {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json())) as FolderData[];
  const newFiles = files.filter((file) => !beforeFiles.some((before) => before.id === file.id));
  const rootFolder = findFolder(folders, rootName, targetFolder.id);
  expect(rootFolder).toBeTruthy();
  const nestedFolder = findFolder(folders, "nested", rootFolder!.id);
  expect(nestedFolder).toBeTruthy();
  expect(newFiles.some((file) => file.filename === "top.txt" && file.folder_id === rootFolder!.id)).toBeTruthy();
  expect(newFiles.some((file) => file.filename === "deep.txt" && file.folder_id === nestedFolder!.id)).toBeTruthy();
});

test("secure drop sender route fails clearly when the fragment key is missing", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  const uploadUrl = await createUploadRoute(page, account);
  const urlWithoutKey = uploadUrl.split("#")[0] ?? uploadUrl;
  await page.goto(urlWithoutKey, { waitUntil: "domcontentloaded" });

  // With the improved error UX, a missing key now shows a distinct "Incomplete upload link" page
  // instead of loading the upload form and failing later
  await expect(page.getByText("Incomplete upload link")).toBeVisible();
  await expect(page.getByText("the part after # is required")).toBeVisible();
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

test("file request folder upload preserves nested relative paths and completes", async ({ page }) => {
  const account = buildOwnerAccount();

  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account);

  const requestUrl = await createFileRequestRoute(page);
  const token = await getAuthToken(page);
  const beforeFiles = (await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json())) as OwnerFileData[];

  const folderFixture = createNestedUploadFixture("request-folder-proof");

  await page.goto(requestUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Secure File Request")).toBeVisible();
  await page.getByPlaceholder("Enter a secure password…").fill("SenderPass!123");
  await page.locator("#folder-input-req").setInputFiles(folderFixture);
  await page.getByRole("button", { name: "Send Securely" }).click();

  await expect(page.getByText("Files sent securely")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Delivery receipt")).toBeVisible();

  const filesResponse = await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(filesResponse.ok()).toBeTruthy();
  const files = (await filesResponse.json()) as OwnerFileData[];
  const folders = (await page.request.get(resolveApiUrl("/api/folders"), {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json())) as FolderData[];
  const newFiles = files.filter((file) => !beforeFiles.some((before) => before.id === file.id));
  const rootFolder = findFolder(folders, path.basename(folderFixture), "");
  expect(rootFolder).toBeTruthy();
  const nestedFolder = findFolder(folders, "nested", rootFolder!.id);
  expect(nestedFolder).toBeTruthy();
  expect(newFiles.some((file) => file.filename === "top.txt" && file.folder_id === rootFolder!.id)).toBeTruthy();
  expect(newFiles.some((file) => file.filename === "deep.txt" && file.folder_id === nestedFolder!.id)).toBeTruthy();
});
