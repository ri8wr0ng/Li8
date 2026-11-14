import { v, type Infer } from "convex/values";

export const vSeriesKind = v.union(
  v.literal("manga"),
  v.literal("manhwa"),
  v.literal("manhua"),
  v.literal("webtoon"),
  v.literal("novel"),
  v.literal("other"),
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
