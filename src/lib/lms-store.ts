import type { RawData } from "@/lib/lms";

export type StoredUpload = {
  fileName: string;
  uploadedAt: string;
  data: RawData;
};

const DB = "lms-dashboard";
const STORE = "uploads";
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export const loadUpload = () =>
  tx<StoredUpload | undefined>("readonly", (s) => s.get(KEY) as IDBRequest<StoredUpload | undefined>);

export const saveUpload = (upload: StoredUpload) =>
  tx("readwrite", (s) => s.put(upload, KEY) as IDBRequest<IDBValidKey>);

export const clearUpload = () => tx("readwrite", (s) => s.delete(KEY) as IDBRequest<undefined>);
