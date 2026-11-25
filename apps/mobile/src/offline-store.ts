// Where the offline copy lives on a phone: one JSON file in the app's documents directory.
// The web build uses localStorage instead (offline-store.web.ts).
import { File, Paths } from "expo-file-system";

const file = () => new File(Paths.document, "offline-cache.json");

export function readStore(): Promise<string | null> {
  const f = file();
  return f.exists ? f.text() : Promise.resolve(null);
}

export async function writeStore(json: string): Promise<void> {
  const f = file();
  if (!f.exists) f.create();
  await f.write(json);
}

export function clearStore(): Promise<void> {
  const f = file();
  if (f.exists) f.delete();
  return Promise.resolve();
}
