import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { cleanList, requireUserId } from "./lib";
import { vSeriesKind, vSeriesStatus } from "./validators";

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

function assertChapter(chapter: number) {
  if (!Number.isFinite(chapter) || chapter < 0) throw new Error("Chapter must be 0 or more");
}

async function ownSeries(ctx: MutationCtx, id: Id<"series">) {
  const userId = await requireUserId(ctx);
  const series = await ctx.db.get("series", id);
  if (!series || series.userId !== userId) throw new Error("Series not found");
  return series;
}

async function recordChapter(ctx: MutationCtx, series: Doc<"series">, chapter: number) {
  const now = Date.now();
  const last = await ctx.db
    .query("chapterHistory")
    .withIndex("by_series_at", (q) => q.eq("seriesId", series._id))
    .order("desc")
    .first();
  if (last && now - last.at < HISTORY_MERGE_MS) {
    await ctx.db.patch("chapterHistory", last._id, { chapter, at: now });
  } else {
    await ctx.db.insert("chapterHistory", {
      userId: series.userId,
      seriesId: series._id,
      chapter,
      at: now,
    });
  }
  await ctx.db.patch("series", series._id, { chapter, lastReadAt: now, updatedAt: now });
}

export const create = mutation({
  args: {
    title: v.string(),
    chapter: v.optional(v.number()),
    altNames: v.optional(v.array(v.string())),
    kind: v.optional(vSeriesKind),
    status: v.optional(vSeriesStatus),
    description: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    totalChapters: v.optional(v.number()),
    anilistId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required");
    const chapter = args.chapter ?? 0;
    assertChapter(chapter);
    const now = Date.now();
    const id = await ctx.db.insert("series", {
      userId,
      title,
      altNames: cleanList(args.altNames ?? []),
      kind: args.kind ?? "manhua",
      status: args.status ?? "reading",
      chapter,
      description: args.description?.trim() ?? "",
      genres: cleanList(args.genres ?? []),
      ...(args.totalChapters && args.totalChapters > 0 ? { totalChapters: args.totalChapters } : {}),
      ...(args.anilistId !== undefined ? { anilistId: args.anilistId } : {}),
      lastReadAt: now,
      updatedAt: now,
    });
    if (chapter > 0) {
      await ctx.db.insert("chapterHistory", { userId, seriesId: id, chapter, at: now });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("series"),
    title: v.optional(v.string()),
    altNames: v.optional(v.array(v.string())),
    kind: v.optional(vSeriesKind),
    status: v.optional(vSeriesStatus),
    totalChapters: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    readUrlTemplate: v.optional(v.union(v.string(), v.null())),
    anilistId: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, { id, altNames, genres, totalChapters, readUrlTemplate, anilistId, title, ...rest }) => {
    await ownSeries(ctx, id);
    if (title !== undefined && !title.trim()) throw new Error("Title is required");
    await ctx.db.patch("series", id, {
      ...rest,
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(altNames ? { altNames: cleanList(altNames) } : {}),
      ...(genres ? { genres: cleanList(genres) } : {}),
      ...(totalChapters !== undefined ? { totalChapters: totalChapters ?? undefined } : {}),
      ...(readUrlTemplate !== undefined
        ? { readUrlTemplate: readUrlTemplate?.trim() || undefined }
        : {}),
      ...(anilistId !== undefined ? { anilistId: anilistId ?? undefined } : {}),
      updatedAt: Date.now(),
    });
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
    const chapter = Math.max(0, series.chapter + delta);
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
    await ctx.db.delete("series", id);
  },
});
