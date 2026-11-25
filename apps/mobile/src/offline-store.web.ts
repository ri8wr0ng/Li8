// Web build of ./offline-store: localStorage, since expo-file-system has no web storage.
const KEY = "inkmark_offline_cache";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStore(): Promise<string | null> {
  return Promise.resolve(storage()?.getItem(KEY) ?? null);
}

export function writeStore(json: string): Promise<void> {
  try {
    storage()?.setItem(KEY, json);
  } catch {
    // Quota exceeded: keep running on the in-memory copy.
  }
  return Promise.resolve();
}

export function clearStore(): Promise<void> {
  storage()?.removeItem(KEY);
  return Promise.resolve();
}
