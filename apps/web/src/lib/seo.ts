import { useEffect } from "react";

export const SITE_NAME = "Inkmark";
export const TAGLINE = "Notes, and where you left off.";
/** Title for the landing (sign-in) page, the one page search engines should list. */
export const HOME_TITLE = `${SITE_NAME}: notes and a manga reading tracker`;
export const DESCRIPTION =
  "Inkmark is a notes app with a reading tracker for manga, manhwa and manhua. Notes save as you type, search finds them in a keystroke, and it works offline as an installable app.";

/** Public origin without a trailing slash, or "" when unknown (see vite/seo.ts). */
export const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? "";

/** Absolute URL when the origin is known, otherwise the path as-is. */
export function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

/** "Library · Inkmark". Pass nothing for the bare site name. */
export function pageTitle(title?: string) {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

/**
 * Sets the tab title from data that only exists after render (a note or
 * series name). Static titles belong in the route's `head` instead; the
 * route's own title shows until this runs and comes back on navigation.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = pageTitle(title);
  }, [title]);
}
