import { useCallback, useSyncExternalStore } from "react";

/**
 * A tiny replacement for next-themes. The class on <html> is set before first
 * paint by THEME_INIT_SCRIPT (rendered with <ScriptOnce> into the prerendered
 * shell), so React never renders a <script> tag on the client.
 */
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";
const COLORS: Record<ResolvedTheme, string> = { light: "#F7F4EE", dark: "#131210" };

/** Runs in <head> before the app loads. Keep it dependency-free and in sync with `apply()`. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var d=t==="dark"||((t!=="light")&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${COLORS.dark}":"${COLORS.light}")}catch(e){}})()`;

const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

let state = typeof window === "undefined" ? null : snapshot(readTheme());

function snapshot(theme: Theme) {
  const resolved: ResolvedTheme = theme === "system" ? (media().matches ? "dark" : "light") : theme;
  return { theme, resolved };
}

function apply() {
  if (!state) return;
  const root = document.documentElement;
  // Skip transitions while the palette swaps, so nothing animates between themes.
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  root.classList.toggle("dark", state.resolved === "dark");
  root.style.colorScheme = state.resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[state.resolved]);
  void getComputedStyle(document.body).opacity;
  requestAnimationFrame(() => style.remove());
}

function set(theme: Theme) {
  state = snapshot(theme);
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode: the choice lasts for this session.
  }
  apply();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    media().addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      media().removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    }
  };
}

function onSystemChange() {
  if (state?.theme === "system") set("system");
}
function onStorage(e: StorageEvent) {
  if (e.key === STORAGE_KEY) set(readTheme());
}

const serverSnapshot = { theme: "system" as Theme, resolved: "light" as ResolvedTheme };

export function useTheme() {
  const s = useSyncExternalStore(
    subscribe,
    () => state ?? serverSnapshot,
    () => serverSnapshot,
  );
  const setTheme = useCallback((theme: string) => set(theme as Theme), []);
  return { theme: s.theme, resolvedTheme: s.resolved, setTheme };
}
