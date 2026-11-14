import type { SeriesKind, SeriesStatus } from "../../convex/validators";

export const STATUS_LABEL: Record<SeriesStatus, string> = {
  reading: "Reading",
  planned: "Plan to read",
  on_hold: "On hold",
  completed: "Completed",
  dropped: "Dropped",
};
export const STATUS_ORDER: SeriesStatus[] = ["reading", "planned", "on_hold", "completed", "dropped"];

export const KIND_LABEL: Record<SeriesKind, string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
  webtoon: "Webtoon",
  novel: "Novel",
  other: "Other",
};
export const KIND_ORDER: SeriesKind[] = ["manhua", "manhwa", "manga", "webtoon", "novel", "other"];

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
