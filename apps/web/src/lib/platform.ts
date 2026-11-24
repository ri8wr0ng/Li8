import { useSyncExternalStore } from "react";

export type Platform = "android" | "iphone" | "computer";

export const PLATFORMS: readonly Platform[] = ["android", "iphone", "computer"];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac, so check for touch too.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return "iphone";
  }
  return "computer";
}

const subscribe = () => () => {};

/**
 * The visitor's platform, or null while prerendering and hydrating, so the first client render
 * matches the prerendered HTML.
 */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(subscribe, detectPlatform, () => null);
}
