import { useSyncExternalStore } from "react";

/**
 * Install-to-home-screen state.
 *
 * Chromium fires `beforeinstallprompt` once, early, so this module listens at
 * import time (it's imported by the root providers) and holds on to the event.
 * iOS has no such event; there the only path is Share → Add to Home Screen,
 * so we show a hint instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export type InstallState =
  | { kind: "none" }
  | { kind: "prompt"; install: () => Promise<boolean> }
  | { kind: "ios" };

const DISMISS_KEY = "install-dismissed-at";
const VISITS_KEY = "visits";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => {
  cache = compute();
  listeners.forEach((l) => l());
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS/iPadOS Safari: the only browser that exposes `navigator.standalone`, on a touch screen. */
function isIosSafari() {
  return "standalone" in navigator && window.matchMedia("(pointer: coarse)").matches;
}

function compute(): InstallState {
  if (typeof window === "undefined" || installed || isStandalone()) return { kind: "none" };
  if (deferred) {
    const event = deferred;
    return {
      kind: "prompt",
      install: async () => {
        await event.prompt();
        const { outcome } = await event.userChoice;
        deferred = null;
        notify();
        return outcome === "accepted";
      },
    };
  }
  return isIosSafari() ? { kind: "ios" } : { kind: "none" };
}

let cache: InstallState = { kind: "none" };

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // We show our own, quieter prompt.
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
  try {
    if (sessionStorage.getItem("counted") === null) {
      sessionStorage.setItem("counted", "1");
      localStorage.setItem(VISITS_KEY, String(Number(localStorage.getItem(VISITS_KEY) ?? 0) + 1));
    }
  } catch {
    // Storage blocked: the banner just won't wait for a second visit.
  }
  cache = compute();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How the app can be installed here, if at all. */
export function useInstall() {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => cache,
  );
}

/** The banner waits for a second visit and stays away for a month once dismissed. */
export function bannerWanted() {
  try {
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const visits = Number(localStorage.getItem(VISITS_KEY) ?? 0);
    return visits >= 2 && Date.now() - dismissed > SNOOZE_MS;
  } catch {
    return true;
  }
}

export function dismissBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}
