import { getAuthUserId } from "@convex-dev/auth/server";
import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deleteEmbedding, scheduleSeriesEmbedding } from "./embeddings";
import { cleanList, requireUserId } from "./lib";
import { vSeriesKind, vSeriesLink, vSeriesStatus, type SeriesLink } from "./validators";

const MAX_LINKS = 20;

/** Trim, drop empty or duplicate URLs, and reject anything that isn't http(s). */
function cleanLinks(links: SeriesLink[]): SeriesLink[] {
  const seen = new Set<string>();
  const out: SeriesLink[] = [];
  for (const link of links) {
    const url = link.url.trim();
    if (!url || seen.has(url)) continue;
    if (!/^https?:\/\//i.test(url)) throw new Error("Links must start with http:// or https://");
    seen.add(url);
    const label = link.label?.trim();
    out.push(label ? { url, label } : { url });
  }
  if (out.length > MAX_LINKS) throw new Error(`At most ${MAX_LINKS} links`);
  return out;
}

/** Rapid edits (+1, +1, +1) within this window collapse into one history entry. */
const HISTORY_MERGE_MS = 10 * 60 * 1000;
/** Personal-scale cap; the client indexes these for instant search. */
const MAX_SERIES = 2000;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("series")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_SERIES);
  },
});

export const get = query({
  args: { id: v.id("series") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const series = await ctx.db.get("series", id);
    if (!series || series.userId !== userId) return null;
    return series;
  },
});

export const history = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const userId = await getAuthUserId(ctx);
    const series = await ctx.db.get("series", seriesId);
    if (!series || series.userId !== userId) return [];
    return await ctx.db
      .query("chapterHistory")
      .withIndex("by_series_at", (q) => q.eq("seriesId", seriesId))
      .order("desc")
      .take(30);
  },
});

export function assertChapter(chapter: number) {
  if (!Number.isFinite(chapter) || chapter < 0) throw new Error("Chapter must be 0 or more");
}

async function ownSeries(ctx: MutationCtx, id: Id<"series">) {
  const userId = await requireUserId(ctx);
  const series = await ctx.db.get("series", id);
  if (!series || series.userId !== userId) throw new Error("Series not found");
  return series;
}

async function validateLabelIds(ctx: MutationCtx, userId: Id<"users">, labelIds?: Id<"labels">[]) {
  if (!labelIds || labelIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(labelIds));
  for (const labelId of uniqueIds) {
    const label = await ctx.db.get("labels", labelId);
    if (!label || label.userId !== userId) {
      throw new Error("Label not found or not owned by user");
    }
  }
  return uniqueIds;
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

export function computeSearchText(item: {
  title: string;
  altNames?: string[];
  genres?: string[];
  kind: string;
}) {
  const altNames = item.altNames ?? [];
  const acronyms = [item.title, ...altNames].map(acronym).filter(Boolean);
  const parts = [item.title, ...altNames, ...acronyms, ...(item.genres ?? []), item.kind].filter(
    Boolean,
  );
  return parts.join(" ");
}

/** Set the chapter and log it. Shared with the AI assistant's tools. */
export async function recordChapter(ctx: MutationCtx, series: Doc<"series">, chapter: number) {
  const now = Date.now();
  const last = await ctx.db
    .query("chapterHistory")
    .withIndex("by_series_at", (q) => q.eq("seriesId", series._id))
    .order("desc")
    .first();
  if (last && now - last.at < HISTORY_MERGE_MS && last.season === series.season) {
    await ctx.db.patch("chapterHistory", last._id, {
      chapter,
      at: now,
      ...(series.season !== undefined ? { season: series.season } : {}),
    });
  } else {
    await ctx.db.insert("chapterHistory", {
      userId: series.userId,
      seriesId: series._id,
      season: series.season,
      chapter,
      at: now,
    });
  }
  await ctx.db.patch("series", series._id, { chapter, lastReadAt: now, updatedAt: now });
}

const vCreateArgs = v.object({
  title: v.string(),
  chapter: v.optional(v.number()),
  season: v.optional(v.number()),
  totalSeasons: v.optional(v.number()),
  labelIds: v.optional(v.array(v.id("labels"))),
  altNames: v.optional(v.array(v.string())),
  kind: v.optional(vSeriesKind),
  status: v.optional(vSeriesStatus),
  description: v.optional(v.string()),
  genres: v.optional(v.array(v.string())),
  totalChapters: v.optional(v.number()),
  anilistId: v.optional(v.number()),
});

export const create = mutation({
  args: vCreateArgs.fields,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await insertSeries(ctx, userId, args);
  },
});

/** Shared with the AI assistant's addSeries tool. */
export async function insertSeries(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: Infer<typeof vCreateArgs>,
) {
  const title = args.title.trim();
  if (!title) throw new Error("Title is required");
  const chapter = args.chapter ?? 0;
  assertChapter(chapter);
  const validLabelIds = args.labelIds
    ? await validateLabelIds(ctx, userId, args.labelIds)
    : undefined;
  const now = Date.now();
  const kind = args.kind ?? "manhua";
  const altNames = cleanList(args.altNames ?? []);
  const genres = cleanList(args.genres ?? []);
  const searchText = computeSearchText({ title, altNames, genres, kind });
  const id = await ctx.db.insert("series", {
    userId,
    title,
    altNames,
    kind,
    status: args.status ?? "reading",
    chapter,
    description: args.description?.trim() ?? "",
    genres,
    ...(args.totalChapters && args.totalChapters > 0 ? { totalChapters: args.totalChapters } : {}),
    ...(args.season !== undefined ? { season: args.season } : {}),
    ...(args.totalSeasons !== undefined && args.totalSeasons > 0
      ? { totalSeasons: args.totalSeasons }
      : {}),
    ...(validLabelIds && validLabelIds.length > 0 ? { labelIds: validLabelIds } : {}),
    searchText,
    ...(args.anilistId !== undefined ? { anilistId: args.anilistId } : {}),
    lastReadAt: now,
    updatedAt: now,
  });
  if (chapter > 0 || (args.season !== undefined && args.season > 1)) {
    await ctx.db.insert("chapterHistory", {
      userId,
      seriesId: id,
      season: args.season,
      chapter,
      at: now,
    });
  }
  await scheduleSeriesEmbedding(ctx, id);
  return id;
}

export const update = mutation({
  args: {
    id: v.id("series"),
    title: v.optional(v.string()),
    altNames: v.optional(v.array(v.string())),
    kind: v.optional(vSeriesKind),
    status: v.optional(vSeriesStatus),
    totalChapters: v.optional(v.union(v.number(), v.null())),
    season: v.optional(v.union(v.number(), v.null())),
    totalSeasons: v.optional(v.union(v.number(), v.null())),
    labelIds: v.optional(v.array(v.id("labels"))),
    description: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    readUrlTemplate: v.optional(v.union(v.string(), v.null())),
    links: v.optional(v.array(vSeriesLink)),
    anilistId: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (
    ctx,
    {
      id,
      altNames,
      genres,
      totalChapters,
      season,
      totalSeasons,
      labelIds,
      readUrlTemplate,
      links,
      anilistId,
      title,
      ...rest
    },
  ) => {
    const series = await ownSeries(ctx, id);
    if (title !== undefined && !title.trim()) throw new Error("Title is required");
    const validLabelIds =
      labelIds !== undefined ? await validateLabelIds(ctx, series.userId, labelIds) : undefined;
    const nextTitle = title !== undefined ? title.trim() : series.title;
    const nextAltNames = altNames !== undefined ? cleanList(altNames) : series.altNames;
    const nextGenres = genres !== undefined ? cleanList(genres) : series.genres;
    const nextKind = rest.kind !== undefined ? rest.kind : series.kind;
    const searchText = computeSearchText({
      title: nextTitle,
      altNames: nextAltNames,
      genres: nextGenres,
      kind: nextKind,
    });
    await ctx.db.patch("series", id, {
      ...rest,
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(altNames ? { altNames: cleanList(altNames) } : {}),
      ...(genres ? { genres: cleanList(genres) } : {}),
      ...(totalChapters !== undefined ? { totalChapters: totalChapters ?? undefined } : {}),
      ...(season !== undefined ? { season: season ?? undefined } : {}),
      ...(totalSeasons !== undefined ? { totalSeasons: totalSeasons ?? undefined } : {}),
      ...(validLabelIds !== undefined ? { labelIds: validLabelIds } : {}),
      ...(readUrlTemplate !== undefined
        ? { readUrlTemplate: readUrlTemplate?.trim() || undefined }
        : {}),
      // Saving links replaces the legacy single reading link.
      ...(links !== undefined ? { links: cleanLinks(links), readUrlTemplate: undefined } : {}),
      ...(anilistId !== undefined ? { anilistId: anilistId ?? undefined } : {}),
      searchText,
      updatedAt: Date.now(),
    });
    await scheduleSeriesEmbedding(ctx, id);
  },
});

export const nextSeason = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, { id }) => {
    const series = await ownSeries(ctx, id);
    const nextSeasonNumber = (series.season ?? 1) + 1;
    const now = Date.now();
    await ctx.db.insert("chapterHistory", {
      userId: series.userId,
      seriesId: id,
      season: nextSeasonNumber,
      chapter: 0,
      at: now,
    });
    await ctx.db.patch("series", id, {
      season: nextSeasonNumber,
      chapter: 0,
      lastReadAt: now,
      updatedAt: now,
    });
    return { season: nextSeasonNumber, chapter: 0 };
  },
});

export const setChapter = mutation({
  args: { id: v.id("series"), chapter: v.number() },
  handler: async (ctx, { id, chapter }) => {
    assertChapter(chapter);
    const series = await ownSeries(ctx, id);
    if (series.chapter !== chapter) await recordChapter(ctx, series, chapter);
  },
});

export const bump = mutation({
  args: { id: v.id("series"), delta: v.number() },
  handler: async (ctx, { id, delta }) => {
    const series = await ownSeries(ctx, id);
    if (!Number.isFinite(delta)) throw new Error("Chapter change must be finite");
    const chapter = Math.max(0, series.chapter + delta);
    assertChapter(chapter);
    if (chapter !== series.chapter) await recordChapter(ctx, series, chapter);
    return chapter;
  },
});

export const remove = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, { id }) => {
    await ownSeries(ctx, id);
    for await (const entry of ctx.db
      .query("chapterHistory")
      .withIndex("by_series_at", (q) => q.eq("seriesId", id))) {
      await ctx.db.delete("chapterHistory", entry._id);
    }
    await deleteEmbedding(ctx, { seriesId: id });
    await ctx.db.delete("series", id);
  },
});

export const backfillSearchText = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const res = await ctx.db
      .query("series")
      .paginate({ cursor: args.cursor ?? null, numItems: 200 });
    for (const item of res.page) {
      const searchText = computeSearchText(item);
      if (item.searchText !== searchText) {
        await ctx.db.patch("series", item._id, { searchText });
      }
    }
    if (!res.isDone) {
      await ctx.scheduler.runAfter(0, internal.series.backfillSearchText, {
        cursor: res.continueCursor,
      });
    }
  },
});
