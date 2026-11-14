import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { useEffect, useSyncExternalStore } from "react";

/**
 * A read-only offline copy of the last list results, kept in IndexedDB.
 *
 * On startup the whole store is loaded into memory once (it's a handful of
 * keys), so the app shell can render lists and search instantly — before the
 * Convex websocket has authenticated, and with no network at all.
 */

const DB_NAME = "inkmark";
const STORE = "cache";
const VERSION_KEY = "v1";

const memory = new Map<string, unknown>();
const listeners = new Set<() => void>();
let ready = false;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function notify() {
  listeners.forEach((l) => l());
}

/** Load everything into memory. Safe to call more than once. */
export const loadCache: () => Promise<void> = (() => {
  let loading: Promise<void> | null = null;
  return () =>
    (loading ??= (async () => {
      try {
        const [keys, values] = await Promise.all([
          tx("readonly", (s) => s.getAllKeys()),
          tx("readonly", (s) => s.getAll()),
        ]);
        keys.forEach((k, i) => typeof k === "string" && memory.set(k, values[i]));
      } catch (err) {
        // No IndexedDB (private mode, old browser): run without a cache.
        console.warn("Offline cache unavailable", err);
      } finally {
        ready = true;
        notify();
      }
    })());
})();

if (typeof window !== "undefined") void loadCache();

function write(key: string, value: unknown) {
  memory.set(key, value);
  notify();
  tx("readwrite", (s) => s.put(value, key)).catch(() => {});
}

/** Forget everything. Called on sign-out so the next account never sees this one's data. */
export function clearCache() {
  memory.clear();
  notify();
  return tx("readwrite", (s) => s.clear()).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCacheReady() {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  );
}

/** True when a saved copy of the notes and library exists. */
export function useHasCache() {
  return useSyncExternalStore(
    subscribe,
    () => memory.has(cacheKey("notes")),
    () => false,
  );
}

const cacheKey = (name: string) => `${VERSION_KEY}:${name}`;

/**
 * `useQuery` for an argument-less list query, backed by the offline cache.
 * Live results win and are written through; until they arrive (or while
 * offline) the last saved copy is returned.
 *
 * The live query only runs once Convex has authenticated, because these
 * queries return an empty list to anonymous callers and that must never
 * overwrite the saved copy.
 */
export function useCachedQuery<
  Query extends FunctionReference<"query", "public", Record<string, never>>,
>(query: Query, name: string): FunctionReturnType<Query> | undefined {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(query, ...((isAuthenticated ? [{}] : ["skip"]) as [Record<string, never>]));
  const key = cacheKey(name);
  const cached = useSyncExternalStore(
    subscribe,
    () => memory.get(key) as FunctionReturnType<Query> | undefined,
    () => undefined,
  );
  useEffect(() => {
    if (live !== undefined) write(key, live);
  }, [key, live]);
  return live ?? cached;
}

// ---------------------------------------------------------------------------
// Connectivity

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * True while the app shows the saved copy because Convex hasn't confirmed the
 * session yet (opened offline, or the first moment of a normal start).
 *
 * Losing the connection *after* that doesn't make the app read-only: the
 * Convex client keeps the last results and queues writes until it reconnects,
 * so an edit in progress isn't yanked away by a flaky network.
 */
export function useReadOnly() {
  return !useConvexAuth().isAuthenticated;
}
