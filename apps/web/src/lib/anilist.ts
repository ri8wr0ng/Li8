import type { SeriesKind } from "@inkmark/backend/convex/validators";

/**
 * AniList lookups, straight from the browser.
 *
 * Why the client and not a Convex action: AniList is public (no key, CORS
 * enabled) and rate-limits per IP. From the browser each user gets their own
 * budget; through Convex every user would share the deployment's egress IPs
 * and one heavy typist could throttle everyone. It's also one hop instead of
 * two, which matters for search-as-you-type.
 */

const ENDPOINT = "https://graphql.anilist.co";

export type AniListMedia = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[] | null;
  countryOfOrigin: string | null;
  format: string | null;
  status: string | null;
  chapters: number | null;
  genres: string[] | null;
  description: string | null;
  startDate: { year: number | null } | null;
};

/** What a pick fills in on a series. */
export type AniListFill = {
  anilistId: number;
  title: string;
  altNames: string[];
  description: string;
  genres: string[];
  kind: SeriesKind;
  totalChapters: number | null;
};

export class AniListError extends Error {
  constructor(
    readonly kind: "rate_limit" | "network" | "not_found" | "server",
    message: string,
    readonly retryAt?: number,
  ) {
    super(message);
  }
}

const FIELDS = `id title { romaji english native } synonyms countryOfOrigin format status chapters genres description(asHtml: false) startDate { year }`;

const SEARCH = `query ($search: String) { Page(perPage: 8) { media(search: $search, type: MANGA, sort: [SEARCH_MATCH, POPULARITY_DESC], isAdult: false) { ${FIELDS} } } }`;
const BY_ID = `query ($id: Int) { Media(id: $id, type: MANGA) { ${FIELDS} } }`;

/** While rate-limited, don't send anything until this time (ms epoch). */
let blockedUntil = 0;
const searchCache = new Map<string, AniListMedia[]>();

async function request<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (Date.now() < blockedUntil) {
    throw new AniListError("rate_limit", "AniList is busy. Try again in a moment.", blockedUntil);
  }
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new AniListError("network", "Couldn't reach AniList.");
  }
  if (res.status === 429) {
    const seconds = Number(res.headers.get("Retry-After")) || 30;
    blockedUntil = Date.now() + seconds * 1000;
    throw new AniListError("rate_limit", "AniList is busy. Try again in a moment.", blockedUntil);
  }
  const json: {
    data?: T;
    errors?: { message: string; status?: number }[];
  } | null = await res.json().catch(() => null);
  if (res.status === 404 || json?.errors?.some((e) => e.status === 404)) {
    throw new AniListError("not_found", "AniList doesn't have that series anymore.");
  }
  if (!res.ok || !json?.data) {
    throw new AniListError("server", "AniList had a problem. Try again later.");
  }
  return json.data;
}

export async function searchAniList(search: string, signal?: AbortSignal) {
  const key = search.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  const data = await request<{ Page: { media: AniListMedia[] } }>(
    SEARCH,
    { search: search.trim() },
    signal,
  );
  searchCache.set(key, data.Page.media);
  return data.Page.media;
}

export async function getAniList(id: number, signal?: AbortSignal) {
  const data = await request<{ Media: AniListMedia | null }>(BY_ID, { id }, signal);
  if (!data.Media) throw new AniListError("not_found", "AniList doesn't have that series anymore.");
  return data.Media;
}

export function kindOf(media: Pick<AniListMedia, "countryOfOrigin" | "format">): SeriesKind {
  if (media.format === "NOVEL") return "novel";
  switch (media.countryOfOrigin) {
    case "JP":
      return "manga";
    case "KR":
      return "manhwa";
    case "CN":
    case "TW":
      return "manhua";
    default:
      return "other";
  }
}

export function displayTitle(media: AniListMedia) {
  return media.title.english ?? media.title.romaji ?? media.title.native ?? "Untitled";
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** AniList descriptions carry <br>, <i> and entities even with asHtml: false. */
export function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code =
          e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function fillFrom(media: AniListMedia): AniListFill {
  const title = displayTitle(media);
  const names = [
    media.title.english,
    media.title.romaji,
    media.title.native,
    ...(media.synonyms ?? []),
  ];
  const seen = new Set([title.toLowerCase()]);
  const altNames: string[] = [];
  for (const name of names) {
    const n = name?.trim();
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      altNames.push(n);
    }
  }
  return {
    anilistId: media.id,
    title,
    altNames,
    description: media.description ? stripHtml(media.description) : "",
    genres: media.genres ?? [],
    kind: kindOf(media),
    // Ongoing series report null; only trust the count once AniList has one.
    totalChapters: media.chapters && media.chapters > 0 ? media.chapters : null,
  };
}

const STATUS_LABEL: Record<string, string> = {
  FINISHED: "Finished",
  RELEASING: "Ongoing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
};

/** "Manhwa · Ongoing · 2018 · 210 ch" */
export function describeMedia(media: AniListMedia, kindLabel: (k: SeriesKind) => string) {
  return [
    kindLabel(kindOf(media)),
    media.status ? STATUS_LABEL[media.status] : null,
    media.startDate?.year,
    media.chapters ? `${media.chapters} ch` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function errorMessage(err: unknown) {
  if (err instanceof AniListError) {
    if (err.kind === "rate_limit" && err.retryAt) {
      const s = Math.max(1, Math.ceil((err.retryAt - Date.now()) / 1000));
      return `AniList is busy. Try again in ${s}s.`;
    }
    return err.message;
  }
  return "Couldn't reach AniList.";
}
