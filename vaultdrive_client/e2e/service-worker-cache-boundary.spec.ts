import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const serviceWorkerPath = fileURLToPath(new URL("../public/sw.js", import.meta.url));
let server: Server;
let origin: string;

test.beforeAll(async () => {
  const sw = await readFile(serviceWorkerPath, "utf8");
  server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/sw.js") {
      response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      response.end(sw);
      return;
    }
    if (path === "/api/files" || path === "/api/folders") {
      request.socket.destroy();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    response.end("<!doctype html><title>SW boundary fixture</title><main>fixture</main>");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not expose a port");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("never serves another account's cached file or folder inventory on network failure", async ({ page }) => {
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toContain("/sw.js");

  await page.evaluate(async () => {
    localStorage.setItem("user", JSON.stringify({ id: "previous-account" }));
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("vaultdrive_offline", 1);
      open.onerror = () => reject(open.error);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
        if (!db.objectStoreNames.contains("folders")) db.createObjectStore("folders", { keyPath: "id" });
        if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(["files", "folders", "queue"], "readwrite");
        tx.objectStore("files").put({ id: "previous-file", filename: "previous-account-secret.txt" });
        tx.objectStore("folders").put({ id: "previous-folder", name: "Previous account folder" });
        tx.objectStore("queue").add({ owner_id: "previous-account", type: "rename", file_id: "queued-file", parent_hash: "", updated_at: new Date().toISOString() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("seed transaction aborted"));
      };
    });
    localStorage.setItem("user", JSON.stringify({ id: "current-account" }));
  });

  const results = await page.evaluate(async () => {
    const request = async (path: string) => {
      try {
        const response = await fetch(path, { headers: { Authorization: "Bearer current-account-session" } });
        return { resolved: true, status: response.status, body: await response.text() };
      } catch {
        return { resolved: false, status: 0, body: "" };
      }
    };
    return Promise.all([request("/api/files"), request("/api/folders")]);
  });

  expect(results).toEqual([
    { resolved: false, status: 0, body: "" },
    { resolved: false, status: 0, body: "" },
  ]);

  const queue = await page.evaluate(async () => new Promise<Array<{ owner_id?: string }>>((resolve, reject) => {
    const open = indexedDB.open("vaultdrive_offline", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("queue", "readonly");
      const get = tx.objectStore("queue").getAll();
      get.onsuccess = () => resolve(get.result as Array<{ owner_id?: string }>);
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
    };
  }));
  expect(queue).toHaveLength(1);
  expect(queue[0].owner_id).toBe("previous-account");

  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    indexedDB.deleteDatabase("vaultdrive_offline");
  });
});
