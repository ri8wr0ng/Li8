// A read-only offline copy of the last query results, so the app opens and browses with no
// network. Mirrors the web app's apps/web/src/lib/offline.ts, but caches any query by its name
// and arguments, and persists to a file (offline-store.ts) instead of IndexedDB.
//
// Live results always win and are written through. Until they arrive (opened offline, or the
// first moment of a normal start) the saved copy is returned. Queries only run once Convex has
// authenticated, because they return empty results to anonymous callers and that must never
// overwrite the saved copy.
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  useConvexAuth,
  useConvexConnectionState,
  usePaginatedQuery,
  useQuery,
  type PaginatedQueryArgs,
  type PaginatedQueryItem,
  type PaginatedQueryReference,
} from "convex/react";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";
import { useAuthToken } from "@convex-dev/auth/react";
import { clearStore, readStore, writeStore } from "./offline-store";

const VERSION = 1;
const WRITE_DELAY_MS = 800;

const memory = new Map<string, unknown>();
const listeners = new Set<() => void>();
let ready = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function restore(json: string | null) {
  if (!json) return;
  const saved: unknown = JSON.parse(json);
  if (typeof saved !== "object" || saved === null) return;
  if (!("v" in saved) || saved.v !== VERSION || !("entries" in saved)) return;
  const entries = saved.entries;
  if (typeof entries !== "object" || entries === null) return;
  for (const [key, value] of Object.entries(entries)) {
    // Anything live that already arrived is newer than the file.
    if (!memory.has(key)) memory.set(key, value);
  }
}

async function loadSaved() {
  try {
    restore(await readStore());
  } catch (error) {
    console.warn("Offline copy unreadable; starting without it", error);
  } finally {
    ready = true;
    notify();
  }
}

// Not awaited: a module-level await would hold up the whole app's startup.
// oxlint-disable-next-line unicorn/prefer-top-level-await
void loadSaved();

function persistSoon() {
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const json = JSON.stringify({ v: VERSION, entries: Object.fromEntries(memory) });
    writeStore(json).catch((error: unknown) => console.warn("Couldn't save offline copy", error));
  }, WRITE_DELAY_MS);
}

function write(key: string, value: unknown) {
  if (memory.get(key) === value) return;
  memory.set(key, value);
  notify();
  persistSoon();
}

function cacheKey(query: FunctionReference<"query">, args: unknown) {
  return `${getFunctionName(query)}:${JSON.stringify(args ?? {})}`;
}

/** Forget everything. Call on sign-out so the next account never sees this one's data. */
export async function clearCache() {
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = null;
  memory.clear();
  notify();
  await clearStore().catch(() => {});
}

/** True once the saved copy has been read from disk (or found missing). */
export function useCacheReady() {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => ready,
  );
}

/** True when anything has been saved, i.e. the app has synced at least once. */
export function useHasCache() {
  return useSyncExternalStore(
    subscribe,
    () => memory.size > 0,
    () => memory.size > 0,
  );
}

/**
 * `useQuery`, backed by the offline copy. Pass "skip" as with useQuery. Returns the live result,
 * else the last saved one for the same query and arguments, else undefined.
 */
export function useCachedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): FunctionReturnType<Query> | undefined {
  const { isAuthenticated } = useConvexAuth();
  const skip = args === "skip";
  // useQuery's rest-args typing can't follow a generic Query; the args are this query's own.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const live = useQuery(query, (isAuthenticated && !skip ? args : "skip") as never);
  const key = skip ? null : cacheKey(query, args);
  const cached = useSyncExternalStore(
    subscribe,
    () => (key === null ? undefined : memory.get(key)),
    () => (key === null ? undefined : memory.get(key)),
  ) as FunctionReturnType<Query> | undefined;

  useEffect(() => {
    if (key !== null && live !== undefined) write(key, live);
  }, [key, live]);

  if (skip) return undefined;
  return live ?? cached;
}

/**
 * `usePaginatedQuery`, backed by the offline copy of the pages loaded so far. While the live
 * query hasn't loaded, the saved results are returned with status "Exhausted" and a no-op
 * loadMore.
 */
export function useCachedPaginatedQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  options: { initialNumItems: number },
) {
  const { isAuthenticated } = useConvexAuth();
  const skip = args === "skip";
  const live = usePaginatedQuery(query, isAuthenticated && !skip ? args : "skip", options);
  const key = skip ? null : `paginated:${cacheKey(query, args)}`;
  const cached = useSyncExternalStore(
    subscribe,
    () => (key === null ? undefined : memory.get(key)),
    () => (key === null ? undefined : memory.get(key)),
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  ) as typeof live.results | undefined;
  const hasLive = isAuthenticated && !skip && live.status !== "LoadingFirstPage";

  useEffect(() => {
    if (key !== null && hasLive) write(key, live.results);
  }, [hasLive, key, live.results]);

  if (!hasLive && cached !== undefined) {
    return {
      ...live,
      results: cached,
      status: "Exhausted" as const,
      isLoading: false,
      loadMore: (_numItems: number) => {},
    };
  }
  return live;
}

function findInSavedPages(prefix: string, id: string): unknown {
  for (const [key, value] of memory) {
    if (!key.startsWith(prefix) || !Array.isArray(value)) continue;
    const found: unknown = value.find(
      (item: unknown) =>
        typeof item === "object" && item !== null && "_id" in item && item._id === id,
    );
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * An item from any saved page of a paginated list query, by `_id`. Lets a note or series that
 * was listed but never opened still open offline.
 */
export function useSavedListItem<Query extends PaginatedQueryReference>(
  listQuery: Query,
  id: string | undefined,
): PaginatedQueryItem<Query> | undefined {
  const prefix = `paginated:${getFunctionName(listQuery)}:`;
  // The cache only holds what useCachedPaginatedQuery wrote for this query.
  const item: PaginatedQueryItem<Query> | undefined = useSyncExternalStore(
    subscribe,
    () => (id === undefined ? undefined : findInSavedPages(prefix, id)),
    () => undefined,
  );
  return item;
}

// ---------------------------------------------------------------------------
// Connectivity

// How long a fresh start may take to connect before it counts as offline.
const STARTUP_GRACE_MS = 4000;

/**
 * False while the Convex websocket is down: after it has connected once, or when it hasn't
 * managed to connect within a few seconds of launch.
 */
export function useOnline() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGraceOver(true), STARTUP_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);
  if (isWebSocketConnected) return true;
  return !(hasEverConnected || graceOver);
}

/**
 * True while the app shows the saved copy because Convex hasn't confirmed the session (opened
 * offline). Writes need a confirmed session, so editing is paused until then. Losing the
 * connection later doesn't make the app read-only: Convex queues mutations until it reconnects.
 */
export function useReadOnly() {
  return !useConvexAuth().isAuthenticated;
}

// ---------------------------------------------------------------------------
// Session gate

export type SessionGate =
  /** Signed in, or a stored session plus a saved copy (read-only until Convex confirms). */
  | "app"
  /** Still finding out. */
  | "loading"
  /** A stored session but nothing saved yet, and no network to fetch it. */
  | "offline-first-run"
  | "signed-out";

/**
 * Whether to open the app. A stored session plus a saved copy is enough: lists render straight
 * away, and offline they stay that way (read-only) until Convex can confirm the session.
 */
export function useSessionGate(): SessionGate {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const token = useAuthToken();
  const cacheReady = useCacheReady();
  const hasCache = useHasCache();
  const online = useOnline();

  if (isAuthenticated) return "app";
  if (isLoading && token !== null && hasCache) return "app";
  if (isLoading && cacheReady && token !== null && !online) return "offline-first-run";
  if (isLoading || !cacheReady) return "loading";
  return "signed-out";
}
