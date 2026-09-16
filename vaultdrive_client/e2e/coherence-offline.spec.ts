import { expect, test, type Page, type Route } from "@playwright/test";

import {
  buildOwnerAccount,
  completeOnboarding,
  getAuthToken,
  gotoStable,
  loginWithPassword,
  registerAccount,
  resolveApiUrl,
} from "./helpers/trust";

type QueueAction = {
  id?: number;
  action_id?: string;
  owner_id?: string;
  type: "rename" | "delete";
  file_id: string;
  filename?: string;
  new_filename?: string;
  parent_hash: string;
  new_hash?: string;
  updated_at: string;
  status?: "pending" | "failed" | "conflict" | "unknown";
  last_error?: string;
};

type ApiFile = {
  id: string;
  filename: string;
};

async function prepareOwner(page: Page) {
  const account = buildOwnerAccount();
  await registerAccount(page, account);
  await loginWithPassword(page, account);
  await completeOnboarding(page, account, `Offline QA ${Date.now()}`);
  const token = await getAuthToken(page);
  const ownerId = await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}") as { id?: string };
    return user.id;
  });
  expect(ownerId).toBeTruthy();
  return { account, token, ownerId: ownerId as string };
}

async function uploadFixture(page: Page, token: string, filename: string): Promise<ApiFile> {
  const response = await page.request.post(resolveApiUrl("/api/files/upload"), {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: { name: filename, mimeType: "text/plain", buffer: Buffer.from(`fixture:${filename}`) },
      iv: "AA==",
      salt: "AA==",
      algorithm: "AES-GCM",
      credential_scheme: "password",
      wrapped_key: "offline-e2e-wrapped-key",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json() as { file_id: string };
  expect(body.file_id).toBeTruthy();
  return { id: body.file_id, filename };
}

async function listFiles(page: Page, token: string): Promise<ApiFile[]> {
  const response = await page.request.get(resolveApiUrl("/api/files"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<ApiFile[]>;
}

async function auditCount(page: Page, token: string, fileId: string, action: string, actionId: string) {
  const response = await page.request.get(
    resolveApiUrl(`/api/v1/audit?resource_id=${fileId}&action=${action}&limit=50`),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json() as { data?: Array<{ metadata?: { action_id?: string } }> };
  return (body.data ?? []).filter((entry) => entry.metadata?.action_id === actionId).length;
}

async function addQueueActions(page: Page, actions: QueueAction[]) {
  await page.evaluate(async (items) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("vaultdrive_offline", 1);
      open.onerror = () => reject(open.error);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("queue", "readwrite");
        const store = tx.objectStore("queue");
        items.forEach((item) => store.add(item));
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("queue seed aborted"));
      };
    });
    window.dispatchEvent(new Event("offline-action-queued"));
  }, actions);
}

async function readQueue(page: Page): Promise<QueueAction[]> {
  return page.evaluate(async () => new Promise<QueueAction[]>((resolve, reject) => {
    const open = indexedDB.open("vaultdrive_offline", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("queue", "readonly");
      const request = tx.objectStore("queue").getAll();
      request.onsuccess = () => resolve(request.result as QueueAction[]);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    };
  }));
}

async function dispatchOnline(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

async function replayAfterLostResponse(
  page: Page,
  action: QueueAction & { action_id: string },
) {
  let firstPayload: { actions: QueueAction[] } | undefined;
  let applied!: () => void;
  const appliedPromise = new Promise<void>((resolve) => { applied = resolve; });
  const interrupt = async (route: Route) => {
    firstPayload = route.request().postDataJSON() as { actions: QueueAction[] };
    const serverResponse = await route.fetch();
    expect(serverResponse.ok(), await serverResponse.text()).toBeTruthy();
    applied();
    await route.abort("failed");
  };

  await page.route("**/api/v1/files/sync", interrupt);
  await addQueueActions(page, [action]);
  await dispatchOnline(page);
  await appliedPromise;
  await page.unroute("**/api/v1/files/sync", interrupt);

  await expect.poll(async () => (await readQueue(page)).find((row) => row.action_id === action.action_id)?.status)
    .toBe("unknown");
  const reviewRegion = page.getByRole("region", { name: "Offline changes" });
  if (!await reviewRegion.isVisible()) {
    await page.getByRole("button", { name: "Review changes" }).click();
  }
  const row = page.getByRole("listitem").filter({ hasText: action.filename ?? action.file_id });
  await expect(row).toContainText(/server did not confirm|Waiting for server confirmation/i);

  const retryRequest = page.waitForRequest((request) => request.url().endsWith("/api/v1/files/sync") && request.method() === "POST");
  await row.getByRole("button", { name: new RegExp(`Retry ${action.type}`) }).click();
  const retryPayload = (await retryRequest).postDataJSON() as { actions: QueueAction[] };

  expect(firstPayload?.actions).toHaveLength(1);
  expect(firstPayload?.actions[0].action_id).toBe(action.action_id);
  expect(retryPayload.actions).toHaveLength(1);
  expect(retryPayload.actions[0].action_id).toBe(action.action_id);
  await expect.poll(async () => (await readQueue(page)).some((row) => row.action_id === action.action_id)).toBe(false);
}

test.describe("offline coherence against the isolated private backend", () => {
  test("replays lost delete and rename responses once and keeps every uncertain row reviewable", async ({ page }) => {
    const { token, ownerId } = await prepareOwner(page);
    const stamp = Date.now();

    const deleteFile = await uploadFixture(page, token, `delete-${stamp}.txt`);
    const deleteActionId = crypto.randomUUID();
    await replayAfterLostResponse(page, {
      action_id: deleteActionId,
      owner_id: ownerId,
      type: "delete",
      file_id: deleteFile.id,
      filename: deleteFile.filename,
      parent_hash: "",
      updated_at: new Date().toISOString(),
      status: "pending",
    });
    expect((await listFiles(page, token)).some((file) => file.id === deleteFile.id)).toBe(false);
    expect(await auditCount(page, token, deleteFile.id, "file.deleted", deleteActionId)).toBe(1);

    const renameFile = await uploadFixture(page, token, `rename-${stamp}.txt`);
    const renamedFilename = `renamed-${stamp}.txt`;
    const renameActionId = crypto.randomUUID();
    await replayAfterLostResponse(page, {
      action_id: renameActionId,
      owner_id: ownerId,
      type: "rename",
      file_id: renameFile.id,
      filename: renamedFilename,
      new_filename: renamedFilename,
      parent_hash: "",
      new_hash: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
      status: "pending",
    });
    expect((await listFiles(page, token)).find((file) => file.id === renameFile.id)?.filename).toBe(renamedFilename);
    expect(await auditCount(page, token, renameFile.id, "file.renamed", renameActionId)).toBe(1);

    const successfulFile = await uploadFixture(page, token, `mixed-success-${stamp}.txt`);
    const conflictedFile = await uploadFixture(page, token, `mixed-conflict-${stamp}.txt`);
    const successActionId = crypto.randomUUID();
    const conflictActionId = crypto.randomUUID();
    await addQueueActions(page, [
      {
        action_id: successActionId, owner_id: ownerId, type: "delete", file_id: successfulFile.id,
        filename: successfulFile.filename, parent_hash: "", updated_at: new Date().toISOString(), status: "pending",
      },
      {
        action_id: conflictActionId, owner_id: ownerId, type: "delete", file_id: conflictedFile.id,
        filename: conflictedFile.filename, parent_hash: "definitely-stale", updated_at: new Date().toISOString(), status: "pending",
      },
    ]);
    await dispatchOnline(page);
    await expect.poll(async () => (await readQueue(page)).find((row) => row.action_id === conflictActionId)?.status)
      .toBe("conflict");
    expect((await readQueue(page)).some((row) => row.action_id === successActionId)).toBe(false);
    const filesAfterMixed = await listFiles(page, token);
    expect(filesAfterMixed.some((file) => file.id === successfulFile.id)).toBe(false);
    expect(filesAfterMixed.some((file) => file.id === conflictedFile.id)).toBe(true);

    const untouchedFile = await uploadFixture(page, token, `resolved-locally-${stamp}.txt`);
    const locallyResolvedId = crypto.randomUUID();
    await addQueueActions(page, [
      {
        action_id: locallyResolvedId, owner_id: ownerId, type: "delete", file_id: untouchedFile.id,
        filename: untouchedFile.filename, parent_hash: "", updated_at: new Date().toISOString(), status: "unknown",
        last_error: "The response was interrupted.",
      },
      {
        type: "rename", file_id: "legacy-file", filename: "legacy.txt", parent_hash: "",
        updated_at: new Date().toISOString(), status: "pending",
      },
      {
        action_id: crypto.randomUUID(), owner_id: crypto.randomUUID(), type: "delete", file_id: crypto.randomUUID(),
        filename: "another-owner.txt", parent_hash: "", updated_at: new Date().toISOString(), status: "pending",
      },
    ]);
    const reviewButton = page.getByRole("button", { name: /Review changes|Hide details/ });
    if ((await reviewButton.textContent())?.includes("Review")) await reviewButton.click();
    await expect(page.getByText(/Older queued action.*will not be sent/i)).toBeVisible();
    await expect(page.getByText(/Queued for a different account/i)).toBeVisible();

    const locallyResolvedRow = page.getByRole("listitem").filter({ hasText: untouchedFile.filename });
    await locallyResolvedRow.getByRole("button", { name: "I resolved this" }).click();
    await expect.poll(async () => (await readQueue(page)).some((row) => row.action_id === locallyResolvedId)).toBe(false);
    expect((await listFiles(page, token)).some((file) => file.id === untouchedFile.id)).toBe(true);
  });

  test("keeps search and type filters when a failed file list is retried", async ({ page }) => {
    const { token } = await prepareOwner(page);
    const filename = `retry-filter-${Date.now()}.pdf`;
    await uploadFixture(page, token, filename);

    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    });
    const retryPage = await page.context().newPage();

    let fileListAttempts = 0;
    let allowFileListSuccess = false;
    await retryPage.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (
        route.request().method() !== "GET"
        || route.request().resourceType() !== "fetch"
        || !requestUrl.pathname.includes("/files")
      ) return route.continue();
      fileListAttempts += 1;
      if (!allowFileListSuccess) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary fixture failure" }) });
      } else {
        await route.continue();
      }
    });
    await gotoStable(retryPage, "/files");
    await expect.poll(() => fileListAttempts).toBeGreaterThanOrEqual(1);
    await expect(retryPage.getByText(/API error/i)).toBeVisible();

    const search = retryPage.getByRole("searchbox");
    await search.fill("retry-filter");
    await retryPage.getByRole("button", { name: "Documents", exact: true }).click();
    const retryButton = retryPage.getByRole("button", { name: "Try again", exact: true });
    await expect(retryButton).toBeVisible();
    allowFileListSuccess = true;
    await retryButton.click();

    await expect(search).toHaveValue("retry-filter");
    await expect(retryPage.getByRole("button", { name: "Documents", exact: true })).toHaveClass(/bg-primary/);
    await expect.poll(() => retryPage.evaluate((name) => document.body.textContent?.includes(name) ?? false, filename)).toBe(true);
    expect(fileListAttempts).toBeGreaterThanOrEqual(2);
    await retryPage.close();
  });
});
