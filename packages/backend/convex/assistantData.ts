/**
 * Data access for the Ask assistant's tools. These are internal: the user id
 * always comes from the thread owner on the server, never from the model.
 */
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { scheduleNoteEmbedding, scheduleSeriesEmbedding } from "./embeddings";
import { cleanList } from "./lib";
import { insertNote, makeSearchText } from "./notes";
import { assertChapter, computeSearchText, insertSeries, recordChapter } from "./series";
import { vPageRef, vSeriesKind, vSeriesStatus } from "./validators";

const MAX_LIST = 300;
const MAX_NOTE_CHARS = 12_000;

export function seriesSummary(s: Doc<"series">) {
  return {
    id: s._id,
    title: s.title,
    altNames: s.altNames,
    kind: s.kind,
    status: s.status,
    chapter: s.chapter,
    totalChapters: s.totalChapters ?? null,
    season: s.season ?? null,
    totalSeasons: s.totalSeasons ?? null,
    genres: s.genres,
    lastReadAt: new Date(s.lastReadAt).toISOString().slice(0, 10),
  };
}

export const listLibrary = internalQuery({
  args: { userId: v.id("users"), status: v.optional(vSeriesStatus) },
  handler: async (ctx, { userId, status }) => {
    const all = await ctx.db
      .query("series")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_LIST);
    return all.filter((s) => !status || s.status === status).map(seriesSummary);
  },
});

export const readNote = internalQuery({
  args: { userId: v.id("users"), noteId: v.string() },
  handler: async (ctx, { userId, noteId }) => {
    const id = ctx.db.normalizeId("notes", noteId);
    const note = id && (await ctx.db.get("notes", id));
    if (!note || note.userId !== userId) return { error: "No note with that id." };
    return {
      id: note._id,
      title: note.title || "Untitled",
      tags: note.tags,
      updatedAt: new Date(note.updatedAt).toISOString(),
      body:
        note.body.length > MAX_NOTE_CHARS
          ? `${note.body.slice(0, MAX_NOTE_CHARS)}\n…(truncated)`
          : note.body,
    };
  },
});

export const updateChapter = internalMutation({
  args: {
    userId: v.id("users"),
    seriesId: v.string(),
    chapter: v.optional(v.number()),
    delta: v.optional(v.number()),
  },
  handler: async (ctx, { userId, seriesId, chapter, delta }) => {
    const id = ctx.db.normalizeId("series", seriesId);
    const series = id && (await ctx.db.get("series", id));
    if (!series || series.userId !== userId) return { error: "No series with that id." };
    const next = chapter ?? (delta !== undefined ? Math.max(0, series.chapter + delta) : undefined);
    if (next === undefined || !Number.isFinite(next) || next < 0) {
      return { error: "Give a chapter number of 0 or more, or a change like +1." };
    }
    assertChapter(next);
    if (next !== series.chapter) await recordChapter(ctx, series, next);
    return { id: series._id, title: series.title, from: series.chapter, to: next };
  },
});

export const addSeries = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    chapter: v.optional(v.number()),
    season: v.optional(v.number()),
    totalSeasons: v.optional(v.number()),
    kind: v.optional(vSeriesKind),
    status: v.optional(vSeriesStatus),
    altNames: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { userId, ...args }) => {
    if (!args.title.trim()) return { error: "A title is required." };
    if (args.chapter !== undefined && (!Number.isFinite(args.chapter) || args.chapter < 0)) {
      return { error: "Chapter must be 0 or more." };
    }
    const id = await insertSeries(ctx, userId, args);
    return {
      id,
      title: args.title.trim(),
      chapter: args.chapter ?? 0,
      season: args.season ?? null,
    };
  },
});

export const createNote = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { userId, ...args }) => {
    const id = await insertNote(ctx, userId, args);
    return { id, title: args.title.trim() || "Untitled" };
  },
});

export const appendToNote = internalMutation({
  args: { userId: v.id("users"), noteId: v.string(), text: v.string() },
  handler: async (ctx, { userId, noteId, text }) => {
    const id = ctx.db.normalizeId("notes", noteId);
    const note = id && (await ctx.db.get("notes", id));
    if (!note || note.userId !== userId) return { error: "No note with that id." };
    const body = note.body.trimEnd() ? `${note.body.trimEnd()}\n${text}` : text;
    const now = Date.now();
    await ctx.db.patch("notes", note._id, {
      body,
      updatedAt: now,
      searchText: makeSearchText(note.title, body, note.tags),
    });
    await scheduleNoteEmbedding(ctx, note._id, now);
    return { id: note._id, title: note.title || "Untitled" };
  },
});

const MAX_PAGE_CHARS = 6_000;

/** What the user has open, as text for the assistant's instructions; null if it isn't theirs. */
export const pageContext = internalQuery({
  args: { userId: v.id("users"), page: vPageRef },
  handler: async (ctx, { userId, page }): Promise<string | null> => {
    if (page.kind === "note") {
      const note = await ctx.db.get("notes", page.id);
      if (!note || note.userId !== userId) return null;
      const body =
        note.body.length > MAX_PAGE_CHARS
          ? `${note.body.slice(0, MAX_PAGE_CHARS)}\n…(truncated; use readNote for the rest)`
          : note.body;
      return [
        `The user has this note open (noteId ${note._id}). "This note", "here" and "it" mean this note.`,
        `Title: ${note.title || "Untitled"}`,
        `Tags: ${note.tags.length ? note.tags.join(", ") : "none"}`,
        `Pinned: ${note.pinned ? "yes" : "no"}`,
        `Body:\n"""\n${body}\n"""`,
      ].join("\n");
    }
    const series = await ctx.db.get("series", page.id);
    if (!series || series.userId !== userId) return null;
    return [
      `The user has this series open in the Library (seriesId ${series._id}). "This series", "this one" and "it" mean this series.`,
      JSON.stringify({ ...seriesSummary(series), description: series.description.slice(0, 1500) }),
    ].join("\n");
  },
});

export const updateNote = internalMutation({
  args: {
    userId: v.id("users"),
    noteId: v.string(),
    title: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
    body: v.optional(v.string()),
  },
  handler: async (ctx, { userId, noteId, title, tags, pinned, body }) => {
    const id = ctx.db.normalizeId("notes", noteId);
    const note = id && (await ctx.db.get("notes", id));
    if (!note || note.userId !== userId) return { error: "No note with that id." };
    const patch = {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(tags !== undefined ? { tags: cleanList(tags) } : {}),
      ...(pinned !== undefined ? { pinned } : {}),
      ...(body !== undefined ? { body } : {}),
    };
    if (!Object.keys(patch).length) return { error: "Nothing to change." };
    const now = Date.now();
    await ctx.db.patch("notes", note._id, {
      ...patch,
      updatedAt: now,
      searchText: makeSearchText(
        patch.title ?? note.title,
        patch.body ?? note.body,
        patch.tags ?? note.tags,
      ),
    });
    await scheduleNoteEmbedding(ctx, note._id, now);
    return {
      id: note._id,
      title: (patch.title ?? note.title) || "Untitled",
      changed: Object.keys(patch),
    };
  },
});

export const updateSeries = internalMutation({
  args: {
    userId: v.id("users"),
    seriesId: v.string(),
    kind: v.optional(vSeriesKind),
    status: v.optional(vSeriesStatus),
    altNames: v.optional(v.array(v.string())),
    season: v.optional(v.number()),
    totalSeasons: v.optional(v.number()),
    totalChapters: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { userId, seriesId, kind, status, altNames, season, totalSeasons, totalChapters },
  ) => {
    const id = ctx.db.normalizeId("series", seriesId);
    const series = id && (await ctx.db.get("series", id));
    if (!series || series.userId !== userId) return { error: "No series with that id." };
    if (totalChapters !== undefined && (!Number.isFinite(totalChapters) || totalChapters < 0)) {
      return { error: "Total chapters must be 0 or more." };
    }
    const nextKind = kind ?? series.kind;
    const nextAltNames = altNames ? cleanList(altNames) : series.altNames;
    const searchText = computeSearchText({
      title: series.title,
      altNames: nextAltNames,
      genres: series.genres,
      kind: nextKind,
    });
    await ctx.db.patch("series", series._id, {
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(season !== undefined ? { season } : {}),
      ...(totalSeasons !== undefined ? { totalSeasons } : {}),
      ...(altNames ? { altNames: nextAltNames } : {}),
      ...(totalChapters !== undefined ? { totalChapters } : {}),
      searchText,
      updatedAt: Date.now(),
    });
    if (altNames || kind) await scheduleSeriesEmbedding(ctx, series._id);
    return { id: series._id, title: series.title, status: status ?? series.status };
  },
});
