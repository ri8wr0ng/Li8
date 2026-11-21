import { useEffect } from "react";

export const SITE_NAME = "li8";
export const TAGLINE = "Remember where you left off.";
/** Title for the public landing page. */
export const HOME_TITLE = `${SITE_NAME}: notes and a reading tracker`;
export const DESCRIPTION =
  "li8 is a private notebook and a tracker for reading and watching progress. Save notes as you type and pick up where you left off in manga, novels, anime, and TV.";

/** Public origin without a trailing slash, or "" when unknown (see vite/seo.ts). */
export const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? "";

/** Absolute URL when the origin is known, otherwise the path as-is. */
export function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

/** "Library · li8". Pass nothing for the bare site name. */
export function pageTitle(title?: string) {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

export function publicPageHead(path: string, title: string, description: string) {
  return {
    meta: [
      { title: pageTitle(title) },
      { name: "description", content: description },
      { property: "og:title", content: pageTitle(title) },
      { property: "og:description", content: description },
      { name: "twitter:title", content: pageTitle(title) },
      { name: "twitter:description", content: description },
      ...(SITE_URL ? [{ property: "og:url", content: absoluteUrl(path) }] : []),
    ],
    links: SITE_URL ? [{ rel: "canonical", href: absoluteUrl(path) }] : [],
  };
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
