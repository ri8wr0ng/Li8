import { useCallback, useEffect, useSyncExternalStore } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Whether a list screen's bottom search field is showing. On Android the tab bar's search button
 * opens and closes it; iOS has no such button (search is a system tab), so it always shows there.
 */
export type SearchScreen = "notes" | "library";

let open: Record<SearchScreen, boolean> = { notes: false, library: false };
const listeners = new Set<() => void>();

function setOpen(screen: SearchScreen, value: boolean) {
  if (open[screen] === value) return;
  open = { ...open, [screen]: value };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toggleScreenSearch(screen: SearchScreen) {
  setOpen(screen, !open[screen]);
}

export function useScreenSearchOpen(screen: SearchScreen | null): boolean {
  return useSyncExternalStore(subscribe, () => (screen ? open[screen] : false));
}

/**
 * For the screen that owns the field. `close` hides it and clears the query; Android's back
 * button closes it before leaving the screen.
 */
export function useScreenSearch(screen: SearchScreen, clearQuery: () => void) {
  const isOpen = useScreenSearchOpen(screen);
  const visible = Platform.OS === "ios" || isOpen;

  const close = useCallback(() => {
    setOpen(screen, false);
    clearQuery();
  }, [screen, clearQuery]);

  // Closing from the tab bar's button also clears what was typed.
  useEffect(() => {
    if (!isOpen && Platform.OS !== "ios") clearQuery();
  }, [isOpen, clearQuery]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  return { visible, close };
}
