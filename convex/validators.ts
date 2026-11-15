import { v, type Infer } from "convex/values";

export const vSeriesKind = v.union(
  v.literal("manga"),
  v.literal("manhwa"),
  v.literal("manhua"),
  v.literal("webtoon"),
  v.literal("novel"),
  v.literal("other"),
  v.literal("movie"),
  v.literal("tv"),
  v.literal("anime"),
  v.literal("reality"),
);
export type SeriesKind = Infer<typeof vSeriesKind>;

export const vSeriesStatus = v.union(
  v.literal("reading"),
  v.literal("planned"),
  v.literal("on_hold"),
  v.literal("completed"),
  v.literal("dropped"),
);
export type SeriesStatus = Infer<typeof vSeriesStatus>;

/** The page the user has open when talking to the assistant. */
export const vPageRef = v.union(
  v.object({ kind: v.literal("note"), id: v.id("notes") }),
  v.object({ kind: v.literal("series"), id: v.id("series") }),
);
export type PageRef = Infer<typeof vPageRef>;

/** What an AI call was for: an Ask reply, indexing notes/series, or a search. */
export const vUsageKind = v.union(v.literal("chat"), v.literal("index"), v.literal("search"));
export type UsageKind = Infer<typeof vUsageKind>;

/**
 * A link saved on a series. A URL containing `{n}` is a reading/watching link
 * (the next chapter or episode number is filled in); anything else is a plain website link.
 */
export const vSeriesLink = v.object({ url: v.string(), label: v.optional(v.string()) });
export type SeriesLink = Infer<typeof vSeriesLink>;
