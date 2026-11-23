// Web build of ./storage: localStorage instead of expo-secure-store. Not secret on the web,
// the same as the web app's own Convex Auth token storage.
function webStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getItem(key: string): string | null {
  return webStorage()?.getItem(key) ?? null;
}

export function getItemAsync(key: string): Promise<string | null> {
  return Promise.resolve(getItem(key));
}

export function setItemAsync(key: string, value: string): Promise<void> {
  webStorage()?.setItem(key, value);
  return Promise.resolve();
}

export function deleteItemAsync(key: string): Promise<void> {
  webStorage()?.removeItem(key);
  return Promise.resolve();
}
