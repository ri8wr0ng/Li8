import type { SeriesKind, SeriesLink, SeriesStatus } from "../../convex/validators";

export const STATUS_LABEL: Record<SeriesStatus, string> = {
  reading: "In progress",
  planned: "Planned",
  on_hold: "On hold",
  completed: "Completed",
  dropped: "Dropped",
};
export const STATUS_ORDER: SeriesStatus[] = [
  "reading",
  "planned",
  "on_hold",
  "completed",
  "dropped",
];

export const READ_KINDS: SeriesKind[] = ["manga", "manhwa", "manhua", "webtoon", "novel", "other"];

export const WATCH_KINDS: SeriesKind[] = ["movie", "tv", "anime", "reality"];

export function isWatchKind(kind: SeriesKind): boolean {
  return (WATCH_KINDS as readonly string[]).includes(kind);
}

export function isEpisodic(kind: SeriesKind): boolean {
  return kind === "tv" || kind === "anime" || kind === "reality";
}

export const KIND_LABEL: Record<SeriesKind, string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
  webtoon: "Webtoon",
  novel: "Novel",
  other: "Other",
  movie: "Movie",
  tv: "TV series",
  anime: "Anime",
  reality: "Reality show",
};
export const KIND_ORDER: SeriesKind[] = [
  "manhua",
  "manhwa",
  "manga",
  "webtoon",
  "novel",
  "other",
  "anime",
  "tv",
  "movie",
  "reality",
];

export function progressLabel(kind: SeriesKind): string {
  return isWatchKind(kind) ? "Episode" : "Chapter";
}

const WATCH_STATUS_LABEL: Record<SeriesStatus, string> = {
  reading: "Watching",
  planned: "Plan to watch",
  on_hold: "On hold",
  completed: "Completed",
  dropped: "Dropped",
};
const READ_STATUS_LABEL: Record<SeriesStatus, string> = {
  reading: "Reading",
  planned: "Plan to read",
  on_hold: "On hold",
  completed: "Completed",
  dropped: "Dropped",
};

/** "Watching" / "Plan to watch" for shows and movies, "Reading" / "Plan to read" otherwise. */
export function statusLabel(status: SeriesStatus, kind?: SeriesKind): string {
  return (kind && isWatchKind(kind) ? WATCH_STATUS_LABEL : READ_STATUS_LABEL)[status];
}

export const isSeriesStatus = (v: unknown): v is SeriesStatus => STATUS_ORDER.some((s) => s === v);
export const isSeriesKind = (v: unknown): v is SeriesKind => KIND_ORDER.some((k) => k === v);

/** 348 -> "348", 348.5 -> "348.5" */
export function formatChapter(chapter: number) {
  return Number.isInteger(chapter) ? String(chapter) : chapter.toFixed(1).replace(/\.0$/, "");
}

/** Fill `{n}` in a reading URL template. Returns null for anything that isn't http(s). */
export function readUrl(template: string | undefined, chapter: number) {
  if (!template) return null;
  const url = template.replaceAll("{n}", formatChapter(chapter));
  return /^https?:\/\//i.test(url) ? url : null;
}

/** A reading/watching link has `{n}` where the chapter or episode number goes. */
export function isReadingLink(url: string) {
  return url.includes("{n}");
}

export function isHttpUrl(url: string) {
  return /^https?:\/\/\S+$/i.test(url.trim());
}

/** The series' links, falling back to the legacy single reading link. */
export function seriesLinks(series: {
  links?: SeriesLink[];
  readUrlTemplate?: string;
}): SeriesLink[] {
  if (series.links) return series.links;
  return series.readUrlTemplate ? [{ url: series.readUrlTemplate }] : [];
}

/** URL for the next chapter/episode from the first reading link, if any. */
export function nextReadUrl(
  series: { links?: SeriesLink[]; readUrlTemplate?: string },
  chapter: number,
) {
  const link = seriesLinks(series).find((l) => isReadingLink(l.url));
  return link ? readUrl(link.url, chapter) : null;
}

/** Label to show for a link: its own label, else the site's host name. */
export function linkName(link: SeriesLink) {
  if (link.label) return link.label;
  try {
    return new URL(link.url.replaceAll("{n}", "1")).hostname.replace(/^www\./, "");
  } catch {
    return link.url;
  }
}

/** First letter of each word: "Battle Through The Heavens" -> "btth". */
export function acronym(title: string) {
  const words = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.length > 1
    ? words
        .map((w) => w[0])
        .join("")
        .toLowerCase()
    : "";
}

/**
 * Parse commands like "btth 352", "Battle Through The Heavens ch 348", "btth +1".
 * Returns null when the text doesn't end with a chapter number or delta.
 */
export function parseChapterCommand(
  input: string,
):
  | { name: string; chapter: number; delta?: undefined }
  | { name: string; delta: number; chapter?: undefined }
  | null {
  const text = input.trim();
  const delta = /^(.+?)\s+([+-]\d+)$/.exec(text);
  if (delta) return { name: delta[1].trim(), delta: Number(delta[2]) };
  const set = /^(.+?)\s+(?:ch(?:apter)?\.?\s*)?(\d+(?:\.\d+)?)$/i.exec(text);
  if (set) return { name: set[1].trim(), chapter: Number(set[2]) };
  return null;
}

/** Every kind for pickers, grouped Read / Watch. */
export const KIND_OPTIONS: { value: SeriesKind; label: string; group: string }[] = KIND_ORDER.map(
  (k) => ({ value: k, label: KIND_LABEL[k], group: isWatchKind(k) ? "Watch" : "Read" }),
);
