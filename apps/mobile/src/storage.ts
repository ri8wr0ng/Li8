// Key-value storage for the app: the Keychain / Keystore on a phone, localStorage on the web
// build (storage.web.ts), since expo-secure-store has no web implementation.
import * as SecureStore from "expo-secure-store";

/** Synchronous read, for values needed on the first frame. */
export function getItem(key: string): string | null {
  return SecureStore.getItem(key);
}

export function getItemAsync(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export function setItemAsync(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value);
}

export function deleteItemAsync(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key);
}
