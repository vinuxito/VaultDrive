/**
 * Rescue Ledger — Indestructible staging store for user transfers.
 * Ensures that if a user drops Wi-Fi or closes the browser, their work survives.
 */

export interface StagedTransfer {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  createdAt: number;
  status: "staged" | "uploading" | "paused";
}

const DB_NAME = "abrndrive_rescue_db";
const STORE_NAME = "staged_transfers";
const DB_VERSION = 1;

// In-memory fallback if IndexedDB is unavailable or blocked in private browsing
let memoryFallback: StagedTransfer[] = [];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveStagedTransfer(item: StagedTransfer): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Memory fallback
    memoryFallback = memoryFallback.filter((t) => t.id !== item.id);
    memoryFallback.push(item);
  }
}

export async function getStagedTransfers(): Promise<StagedTransfer[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StagedTransfer[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [...memoryFallback];
  }
}

export async function removeStagedTransfer(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback = memoryFallback.filter((t) => t.id !== id);
  }
}

export async function clearStagedTransfers(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback = [];
  }
}
