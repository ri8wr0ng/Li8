import { useEffect, useState } from "react";
import { Appearance } from "react-native";
import { getItemAsync, setItemAsync } from "./storage";

export type ThemePreference = "light" | "dark" | "system";

const KEY = "inkmark.theme";
const listeners = new Set<(value: ThemePreference) => void>();
let current: ThemePreference = "system";

function apply(value: ThemePreference) {
  // Overriding the app's color scheme makes useColorScheme() follow the choice everywhere.
  Appearance.setColorScheme(value === "system" ? "unspecified" : value);
}

/** Restores the saved choice. Called once at startup. */
export async function loadThemePreference() {
  try {
    const saved = await getItemAsync(KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      current = saved;
      apply(saved);
      for (const listener of listeners) listener(saved);
    }
  } catch {
    // Keep following the device.
  }
}

export function setThemePreference(value: ThemePreference) {
  current = value;
  apply(value);
  for (const listener of listeners) listener(value);
  void setItemAsync(KEY, value).catch(() => {});
}

export function useThemePreference() {
  const [value, setValue] = useState(current);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return [value, setThemePreference] as const;
}
