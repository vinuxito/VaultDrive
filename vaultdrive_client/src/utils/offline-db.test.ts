import { describe, expect, it, beforeEach } from "vitest";

// In-memory mock storage for IndexedDB
interface MockStoredItem {
  id?: number;
  [key: string]: unknown;
}

interface MutableMockRequest<T> {
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  result: T | undefined;
}

function createMockRequest<T>(): MutableMockRequest<T> {
  return { onsuccess: null, onerror: null, result: undefined };
}

const mockStores: Record<string, MockStoredItem[]> = {
  files: [],
  folders: [],
  queue: [],
};
let abortNextTransaction = false;

// Mock IndexedDB transaction and objectStore structure
const mockTransaction = (_storeNames: string | string[], _mode: "readonly" | "readwrite") => {
  const finish = () => setTimeout(() => {
    if (abortNextTransaction) {
      abortNextTransaction = false;
      tx.onabort?.(new Event("abort"));
    } else {
      tx.oncomplete?.(new Event("complete"));
    }
  }, 0);
  const tx = {
    objectStore: (name: string) => {
      const store = mockStores[name] || [];
      return {
        add: (item: MockStoredItem) => {
          const id = store.length + 1;
          const newItem = { ...item, id };
          store.push(newItem);
          const req = createMockRequest<number>();
          setTimeout(() => {
            req.result = id;
            if (req.onsuccess) {
              req.onsuccess(new Event("success"));
            }
            finish();
          }, 0);
          return req;
        },
        getAll: () => {
          const req = createMockRequest<MockStoredItem[]>();
          setTimeout(() => {
            req.result = [...store];
            if (req.onsuccess) {
              req.onsuccess(new Event("success"));
            }
          }, 0);
          return req;
        },
        get: (id: number) => {
          const req = createMockRequest<MockStoredItem>();
          setTimeout(() => {
            req.result = store.find((item) => item.id === id);
            req.onsuccess?.(new Event("success"));
          }, 0);
          return req;
        },
        put: (item: MockStoredItem) => {
          const index = store.findIndex((candidate) => candidate.id === item.id);
          if (index >= 0) store[index] = { ...item };
          const req = createMockRequest<number>();
          setTimeout(() => {
            req.result = item.id;
            req.onsuccess?.(new Event("success"));
            finish();
          }, 0);
          return req;
        },
        delete: (id: number) => {
          const idx = store.findIndex((x) => x.id === id);
          if (idx !== -1) store.splice(idx, 1);
          const req = createMockRequest<void>();
          setTimeout(() => {
            req.result = undefined;
            if (req.onsuccess) {
              req.onsuccess(new Event("success"));
            }
            finish();
          }, 0);
          return req;
        },
        clear: () => {
          store.length = 0;
          const req = createMockRequest<void>();
          setTimeout(() => {
            req.result = undefined;
            if (req.onsuccess) {
              req.onsuccess(new Event("success"));
            }
            finish();
          }, 0);
          return req;
        },
      };
    },
    oncomplete: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onabort: null as ((event: Event) => void) | null,
    error: null as DOMException | null,
  };
  return tx;
};

const mockDB = {
  objectStoreNames: {
    contains: (name: string) => ["files", "folders", "queue"].includes(name),
  },
  transaction: mockTransaction,
};

const mockIDBRequest = {
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
  result: undefined,
} as {
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onupgradeneeded: ((event: Event) => void) | null;
  result: typeof mockDB | undefined;
};

const mockIndexedDB = {
  open: () => {
    mockIDBRequest.result = undefined;
    setTimeout(() => {
      mockIDBRequest.result = mockDB;
      if (mockIDBRequest.onsuccess) {
        mockIDBRequest.onsuccess(new Event("success"));
      }
    }, 0);
    return mockIDBRequest;
  },
};

// Set mock globally in JSDOM environment
globalThis.indexedDB = mockIndexedDB as unknown as IDBFactory;

// Now import the DB coordinator that uses the global indexedDB object
import {
  queueOfflineAction,
  getOfflineQueue,
  clearOfflineQueue,
  removeQueueItem,
  updateQueueItem,
} from "./offline-db";

describe("offline-db IndexedDB Coordinator", () => {
  beforeEach(async () => {
    abortNextTransaction = false;
    await clearOfflineQueue();
  });

  it("can queue and retrieve offline actions", async () => {
    const action = {
      type: "delete" as const,
      owner_id: "owner-1",
      file_id: "test-file-id-123",
      filename: "test-file.txt",
      parent_hash: "parent-hash-xyz",
      updated_at: new Date().toISOString(),
    };

    const id = await queueOfflineAction(action);
    expect(id).toBeTypeOf("number");

    const queue = await getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].file_id).toBe("test-file-id-123");
    expect(queue[0].filename).toBe("test-file.txt");
    expect(queue[0].parent_hash).toBe("parent-hash-xyz");
    expect(queue[0].owner_id).toBe("owner-1");
    expect(queue[0].action_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(queue[0].status).toBe("pending");
  });

  it("can remove a queue item by ID", async () => {
    const action = {
      type: "delete" as const,
      owner_id: "owner-1",
      file_id: "test-file-to-remove",
      parent_hash: "some-hash",
      updated_at: new Date().toISOString(),
    };

    const id = await queueOfflineAction(action);
    const initialQueue = await getOfflineQueue();
    expect(initialQueue).toHaveLength(1);

    await removeQueueItem(id);
    const postQueue = await getOfflineQueue();
    expect(postQueue).toHaveLength(0);
  });

  it("can clear the entire queue", async () => {
    await queueOfflineAction({
      type: "delete" as const,
      owner_id: "owner-1",
      file_id: "id-1",
      parent_hash: "hash-1",
      updated_at: new Date().toISOString(),
    });

    await queueOfflineAction({
      type: "delete" as const,
      owner_id: "owner-1",
      file_id: "id-2",
      parent_hash: "hash-2",
      updated_at: new Date().toISOString(),
    });

    const queue = await getOfflineQueue();
    expect(queue).toHaveLength(2);

    await clearOfflineQueue();
    const cleared = await getOfflineQueue();
    expect(cleared).toHaveLength(0);
  });

  it("updates an existing item without changing its stable action id", async () => {
    const id = await queueOfflineAction({
      type: "rename",
      owner_id: "owner-1",
      file_id: "file-1",
      filename: "before.txt",
      new_filename: "after.txt",
      parent_hash: "hash-1",
      updated_at: new Date().toISOString(),
    });
    const [queued] = await getOfflineQueue();

    await updateQueueItem(id, { status: "unknown", last_error: "Response was interrupted" });

    const [updated] = await getOfflineQueue();
    expect(updated.action_id).toBe(queued.action_id);
    expect(updated.status).toBe("unknown");
    expect(updated.last_error).toBe("Response was interrupted");
    expect(updated.new_hash).toBeTruthy();
    expect(updated.new_hash).not.toBe(updated.parent_hash);
  });

  it("does not report a queued write as durable when its transaction aborts", async () => {
    abortNextTransaction = true;
    await expect(queueOfflineAction({
      type: "delete",
      owner_id: "owner-1",
      file_id: "file-1",
      parent_hash: "hash-1",
      updated_at: new Date().toISOString(),
    })).rejects.toThrow("aborted");
  });
});
