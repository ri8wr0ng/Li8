import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import type { SeriesKind } from "@inkmark/backend/convex/validators";

/**
 * Title lookups for filling in a series: AniList for manga, novels, anime and anime films,
 * TVmaze for TV series and reality shows. Both are called straight from the browser.
 *
 * Why the client and not a Convex action: both are public (no key, CORS enabled) and
 * rate-limit per IP. From the browser each user gets their own budget; through Convex every
 * user would share the deployment's egress IPs and one heavy typist could throttle everyone.
 * It's also one hop instead of two, which matters for search-as-you-type.
 *
 * apps/mobile/src/library/anilist.ts is a copy of this file. Keep them in step.
 */

export type CatalogSource = "anilist" | "tvmaze";

/** One match, in AniList's shape. TVmaze shows are mapped into it. */
export type AniListMedia = {
  source: CatalogSource;
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[] | null;
  countryOfOrigin: string | null;
  format: string | null;
  status: string | null;
  chapters: number | null;
  episodes: number | null;
  genres: string[] | null;
  description: string | null;
  startDate: { year: number | null } | null;
  /** Episodes in each season, in order. TVmaze only, and only after `resolveMatch`. */
  seasonEpisodes?: (number | null)[];
};

/** What a pick fills in on a new series. */
export type AniListFill = {
  source: CatalogSource;
  anilistId?: number;
  tvmazeId?: number;
  title: string;
  altNames: string[];
  description: string;
  genres: string[];
  kind: SeriesKind;
  /** Chapters, or episodes in the first season. */
  totalChapters: number | null;
  totalSeasons: number | null;
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

/** Where a kind is looked up. */
export function catalogFor(kind: SeriesKind): CatalogSource {
  return kind === "tv" || kind === "reality" ? "tvmaze" : "anilist";
}

export function catalogName(source: CatalogSource) {
  return source === "tvmaze" ? "TVmaze" : "AniList";
}

/** The catalog a series is linked to, if any. */
export function linkedSource(series: Pick<Doc<"series">, "anilistId" | "tvmazeId">) {
  if (series.tvmazeId) return { source: "tvmaze" as const, id: series.tvmazeId };
  if (series.anilistId) return { source: "anilist" as const, id: series.anilistId };
  return null;
}

// ── AniList ──

const ANILIST = "https://graphql.anilist.co";
const FIELDS = `id title { romaji english native } synonyms countryOfOrigin format status chapters episodes genres description(asHtml: false) startDate { year }`;
const SEARCH = `query ($search: String, $type: MediaType) { Page(perPage: 8) { media(search: $search, type: $type, sort: [SEARCH_MATCH, POPULARITY_DESC], isAdult: false) { ${FIELDS} } } }`;
const BY_ID = `query ($id: Int) { Media(id: $id) { ${FIELDS} } }`;

type AniListRaw = Omit<AniListMedia, "source">;

/** While rate-limited, don't send anything to that catalog until this time (ms epoch). */
const blockedUntil: Record<CatalogSource, number> = { anilist: 0, tvmaze: 0 };
const searchCache = new Map<string, AniListMedia[]>();

function busy(source: CatalogSource) {
  return new AniListError(
    "rate_limit",
    `${catalogName(source)} is busy. Try again in a moment.`,
    blockedUntil[source],
  );
}

async function send(source: CatalogSource, url: string, init: RequestInit) {
  if (Date.now() < blockedUntil[source]) throw busy(source);
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (init.signal?.aborted) throw err;
    throw new AniListError("network", `Couldn't reach ${catalogName(source)}.`);
  }
  if (res.status === 429) {
    const seconds = Number(res.headers.get("Retry-After")) || 30;
    blockedUntil[source] = Date.now() + seconds * 1000;
    throw busy(source);
  }
  return res;
}

const gone = (source: CatalogSource) =>
  new AniListError("not_found", `${catalogName(source)} doesn't have that series anymore.`);
const broken = (source: CatalogSource) =>
  new AniListError("server", `${catalogName(source)} had a problem. Try again later.`);

async function anilist<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await send("anilist", ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  const json: {
    data?: T;
    errors?: { message: string; status?: number }[];
  } | null = await res.json().catch(() => null);
  if (res.status === 404 || json?.errors?.some((e) => e.status === 404)) throw gone("anilist");
  if (!res.ok || !json?.data) throw broken("anilist");
  return json.data;
}

// ── TVmaze ──

const TVMAZE = "https://api.tvmaze.com";

type TvmazeShow = {
  id: number;
  name: string;
  type: string | null;
  language: string | null;
  genres: string[] | null;
  status: string | null;
  premiered: string | null;
  summary: string | null;
  network: { country: { code: string } | null } | null;
  webChannel: { country: { code: string } | null } | null;
  _embedded?: {
    seasons?: { number: number; episodeOrder: number | null }[];
    akas?: { name: string }[];
  };
};

const TVMAZE_STATUS: Record<string, string> = {
  Running: "RELEASING",
  Ended: "FINISHED",
  "To Be Determined": "HIATUS",
  "In Development": "NOT_YET_RELEASED",
};

function fromTvmaze(show: TvmazeShow): AniListMedia {
  const seasons = show._embedded?.seasons
    ?.filter((s) => s.number > 0)
    .toSorted((a, b) => a.number - b.number);
  const year = show.premiered ? Number(show.premiered.slice(0, 4)) : null;
  return {
    source: "tvmaze",
    id: show.id,
    title: { english: show.name, romaji: null, native: null },
    synonyms: show._embedded?.akas?.map((a) => a.name) ?? [],
    countryOfOrigin: show.network?.country?.code ?? show.webChannel?.country?.code ?? null,
    // "Scripted", "Reality", "Animation"… plus the language, which kindOf reads.
    format: show.type === "Animation" && show.language === "Japanese" ? "ANIME" : show.type,
    status: show.status ? (TVMAZE_STATUS[show.status] ?? null) : null,
    chapters: null,
    episodes: seasons?.[0]?.episodeOrder ?? null,
    genres: show.genres,
    description: show.summary,
    startDate: { year: Number.isFinite(year) ? year : null },
    ...(seasons ? { seasonEpisodes: seasons.map((s) => s.episodeOrder) } : {}),
  };
}

async function tvmaze<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await send("tvmaze", `${TVMAZE}${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (res.status === 404) throw gone("tvmaze");
  if (!res.ok) throw broken("tvmaze");
  const json: T | null = await res.json().catch(() => null);
  if (json === null) throw broken("tvmaze");
  return json;
}

const showById = (id: number, signal?: AbortSignal) =>
  tvmaze<TvmazeShow>(`/shows/${id}?embed[]=seasons&embed[]=akas`, signal).then(fromTvmaze);

// ── Public API ──

/** Matches for a title, from the catalog that covers `kind`. */
export async function searchCatalog(search: string, kind: SeriesKind, signal?: AbortSignal) {
  const source = catalogFor(kind);
  const type = kind === "anime" || kind === "movie" ? "ANIME" : "MANGA";
  const key = `${source}:${type}:${search.trim().toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  let results: AniListMedia[];
  if (source === "tvmaze") {
    const data = await tvmaze<{ show: TvmazeShow }[]>(
      `/search/shows?q=${encodeURIComponent(search.trim())}`,
      signal,
    );
    results = data.slice(0, 8).map((r) => fromTvmaze(r.show));
  } else {
    const data = await anilist<{ Page: { media: AniListRaw[] } }>(
      SEARCH,
      { search: search.trim(), type },
      signal,
    );
    results = data.Page.media.map((m) => ({ ...m, source: "anilist" as const }));
  }
  searchCache.set(key, results);
  return results;
}

/** One title by id, with everything a fill needs. */
export async function getCatalog(source: CatalogSource, id: number, signal?: AbortSignal) {
  if (source === "tvmaze") return showById(id, signal);
  const data = await anilist<{ Media: AniListRaw | null }>(BY_ID, { id }, signal);
  if (!data.Media) throw gone("anilist");
  return { ...data.Media, source: "anilist" as const };
}

/**
 * A search result with the details search leaves out. TVmaze search has no seasons or
 * alternative names, so a pick fetches the show; AniList results are already complete.
 */
export function resolveMatch(media: AniListMedia, signal?: AbortSignal) {
  return media.source === "tvmaze" && !media.seasonEpisodes
    ? showById(media.id, signal)
    : Promise.resolve(media);
}

const ANIME_FORMATS = new Set(["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL", "MUSIC", "ANIME"]);

export function kindOf(
  media: Pick<AniListMedia, "source" | "countryOfOrigin" | "format">,
): SeriesKind {
  if (media.format === "MOVIE") return "movie";
  if (media.format && ANIME_FORMATS.has(media.format)) return "anime";
  if (media.source === "tvmaze") return media.format === "Reality" ? "reality" : "tv";
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

/** Descriptions carry <br>, <p>, <i> and entities (AniList even with asHtml: false). */
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

function namesOf(media: AniListMedia) {
  return [media.title.english, media.title.romaji, media.title.native, ...(media.synonyms ?? [])];
}

const positive = (n: number | null | undefined) => (n && n > 0 ? n : null);

/** Chapters, or episodes in a given season (1-based). */
function countFor(media: AniListMedia, season: number) {
  if (media.seasonEpisodes) return positive(media.seasonEpisodes[season - 1]);
  return positive(media.chapters ?? media.episodes);
}

function idsOf(media: AniListMedia) {
  return media.source === "tvmaze" ? { tvmazeId: media.id } : { anilistId: media.id };
}

export function fillFrom(media: AniListMedia): AniListFill {
  const title = displayTitle(media);
  const seen = new Set([title.toLowerCase()]);
  const altNames: string[] = [];
  for (const name of namesOf(media)) {
    const n = name?.trim();
    if (n && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      altNames.push(n);
    }
  }
  return {
    source: media.source,
    ...idsOf(media),
    title,
    altNames,
    description: media.description ? stripHtml(media.description) : "",
    genres: media.genres ?? [],
    kind: kindOf(media),
    // Ongoing series report null; only trust a count once the catalog has one.
    totalChapters: countFor(media, 1),
    totalSeasons: positive(media.seasonEpisodes?.length),
  };
}

const STATUS_LABEL: Record<string, string> = {
  FINISHED: "Finished",
  RELEASING: "Ongoing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
};

/** "Manhwa · Ongoing · 2018 · 210 ch" or "TV series · Ended · 2024 · 24 ep" */
export function describeMedia(media: AniListMedia, kindLabel: (k: SeriesKind) => string) {
  return [
    kindLabel(kindOf(media)),
    media.status ? STATUS_LABEL[media.status] : null,
    media.startDate?.year,
    media.chapters ? `${media.chapters} ch` : media.episodes ? `${media.episodes} ep` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function errorMessage(err: unknown, source: CatalogSource = "anilist") {
  if (err instanceof AniListError) {
    if (err.kind === "rate_limit" && err.retryAt) {
      const s = Math.max(1, Math.ceil((err.retryAt - Date.now()) / 1000));
      return err.message.replace("in a moment", `in ${s}s`);
    }
    return err.message;
  }
  return `Couldn't reach ${catalogName(source)}.`;
}

// ── Applying a match to an existing series ──

export type AniListPatch = {
  anilistId: number | null;
  tvmazeId: number | null;
  altNames: string[];
  description: string;
  genres: string[];
  kind: SeriesKind;
  totalChapters: number | null;
  totalSeasons: number | null;
};

function merge(existing: string[], incoming: (string | null | undefined)[]) {
  const seen = new Set(existing.map((v) => v.toLowerCase()));
  const out = [...existing];
  for (const v of incoming) {
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export function snapshotOf(series: Doc<"series">): AniListPatch {
  return {
    anilistId: series.anilistId ?? null,
    tvmazeId: series.tvmazeId ?? null,
    altNames: series.altNames,
    description: series.description,
    genres: series.genres,
    kind: series.kind,
    totalChapters: series.totalChapters ?? null,
    totalSeasons: series.totalSeasons ?? null,
  };
}

/**
 * Your names and genres are kept and the catalog's added; description, type and counts follow
 * the catalog. Your title is left alone. The episode count is for the season you're on.
 */
export function patchFrom(series: Doc<"series">, media: AniListMedia): AniListPatch {
  const fill = fillFrom(media);
  const names = [fill.title, ...fill.altNames].filter(
    (n) => n.toLowerCase() !== series.title.toLowerCase(),
  );
  return {
    anilistId: fill.anilistId ?? null,
    tvmazeId: fill.tvmazeId ?? null,
    altNames: merge(series.altNames, names),
    description: fill.description || series.description,
    genres: merge(series.genres, fill.genres),
    kind: fill.kind,
    totalChapters: countFor(media, series.season ?? 1) ?? series.totalChapters ?? null,
    totalSeasons: fill.totalSeasons ?? series.totalSeasons ?? null,
  };
}

export const samePatch = (a: AniListPatch, b: AniListPatch) =>
  JSON.stringify(a) === JSON.stringify(b);
