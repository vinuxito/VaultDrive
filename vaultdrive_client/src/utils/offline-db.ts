const DB_NAME = "vaultdrive_offline";
const DB_VERSION = 1;

export interface OfflineAction {
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
	last_attempt_at?: string;
}

export type NewOfflineAction = Omit<OfflineAction, "id" | "action_id" | "status" | "last_error" | "last_attempt_at"> & {
  owner_id: string;
};

export type OfflineActionUpdate = Pick<OfflineAction, "status" | "last_error" | "last_attempt_at">;

export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("folders")) {
        db.createObjectStore("folders", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineAction(action: NewOfflineAction): Promise<number> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const actionId = crypto.randomUUID();
    let storedId: number | null = null;
    const request = store.add({
      ...action,
      action_id: actionId,
      new_hash: action.type === "rename"
        ? (action.new_hash && action.new_hash !== action.parent_hash ? action.new_hash : crypto.randomUUID())
        : action.new_hash,
      status: "pending",
    } satisfies OfflineAction);
    request.onsuccess = () => { storedId = request.result as number; };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => storedId === null
      ? reject(new Error(`Offline action ${actionId} was not stored`))
      : resolve(storedId);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Offline queue transaction was aborted"));
  });
}

export async function updateQueueItem(id: number, patch: OfflineActionUpdate): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const getRequest = store.get(id);
    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const current = getRequest.result as OfflineAction | undefined;
      if (!current) {
        reject(new Error(`Offline queue item ${id} was not found`));
        return;
      }
      const putRequest = store.put({ ...current, ...patch, id });
      putRequest.onsuccess = () => undefined;
      putRequest.onerror = () => reject(putRequest.error);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Offline queue transaction was aborted"));
  });
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readonly");
    const store = tx.objectStore("queue");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineQueue(): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const request = store.clear();
    request.onsuccess = () => undefined;
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Offline queue transaction was aborted"));
  });
}

export async function removeQueueItem(id: number): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const request = store.delete(id);
    request.onsuccess = () => undefined;
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Offline queue transaction was aborted"));
  });
}
