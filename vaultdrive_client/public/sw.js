const DB_NAME = "vaultdrive_offline";
const DB_VERSION = 1;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Helper to open IndexedDB in Service Worker
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
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

function getAllFromStore(storeName) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function saveAllToStore(storeName, items) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.clear();
      items.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // We only intercept GET requests to files and folders lists
  const isGet = event.request.method === "GET";
  const isFilesApi = /\/(v\d+\/)?files\/?$/.test(url.pathname);
  const isFoldersApi = /\/(v\d+\/)?folders\/?$/.test(url.pathname);

  if (isGet && (isFilesApi || isFoldersApi)) {
    const storeName = isFilesApi ? "files" : "folders";

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            copy.json().then((items) => {
              const dataList = Array.isArray(items) ? items : (items.files || []);
              saveAllToStore(storeName, dataList);
            }).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          return getAllFromStore(storeName)
            .then((cachedItems) => {
              const body = JSON.stringify(cachedItems || []);
              return new Response(body, {
                headers: { "Content-Type": "application/json" },
                status: 200,
              });
            })
            .catch(() => {
              return new Response("[]", {
                headers: { "Content-Type": "application/json" },
                status: 200,
              });
            });
        })
    );
  }
});
