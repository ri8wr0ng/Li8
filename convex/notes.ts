import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deleteEmbedding, scheduleNoteEmbedding } from "./embeddings";
import { cleanList, requireUserId } from "./lib";
import schema from "./schema";

/** Personal-scale cap; the client indexes these for instant search. */
const MAX_NOTES = 2000;

function makeSearchText(title: string, body: string, tags: string[]) {
  return [title, body, tags.join(" ")].join(" ");
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("notes")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_NOTES);
  },
});

export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    pinned: v.optional(v.boolean()),
  },
  returns: paginationResultValidator(schema.doc("notes")),
  handler: async (ctx, { paginationOpts, pinned }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { page: [], isDone: true, continueCursor: "" };
    const notes =
      pinned === undefined
        ? ctx.db
            .query("notes")
            .withIndex("by_user_updated", (q) => q.eq("userId", userId))
            .order("desc")
        : ctx.db
            .query("notes")
            .withIndex("by_user_pinned_updated", (q) => q.eq("userId", userId).eq("pinned", pinned))
            .order("desc");
    return await notes.paginate(paginationOpts);
  },
});

export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(schema.doc("notes")),
  handler: async (ctx, { query: input, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const text = input.trim().slice(0, 500);
    if (!text) return [];
    const take = Math.max(0, Math.min(50, Math.floor(limit ?? 20)));
    if (take === 0) return [];
    return await ctx.db
      .query("notes")
      .withSearchIndex("search_text", (q) => q.search("searchText", text).eq("userId", userId))
      .take(take);
  },
});

export const backfillSearchText = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const batch = await ctx.db.query("notes").paginate({ numItems: 200, cursor });
    for (const note of batch.page) {
      if (note.searchText === undefined) {
        await ctx.db.patch("notes", note._id, {
          searchText: makeSearchText(note.title, note.body, note.tags),
        });
      }
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.notes.backfillSearchText, {
        cursor: batch.continueCursor,
      });
    }
    return null;
  },
});

export const get = query({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const note = await ctx.db.get("notes", id);
    if (!note || note.userId !== userId) return null;
    return note;
  },
});

/** Shared with the AI assistant's createNote tool. */
export async function insertNote(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { title?: string; body?: string; tags?: string[] },
) {
  const now = Date.now();
  const title = args.title?.trim() ?? "";
  const body = args.body ?? "";
  const tags = cleanList(args.tags ?? []);
  const id = await ctx.db.insert("notes", {
    userId,
    title,
    body,
    tags,
    pinned: false,
    updatedAt: now,
    searchText: makeSearchText(title, body, tags),
  });
  if (args.title?.trim() || args.body?.trim() || args.tags?.length)
    await scheduleNoteEmbedding(ctx, id, now);
  return id;
}

export const create = mutation({
  args: { title: v.optional(v.string()), body: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await insertNote(ctx, userId, args);
  },
});

async function ownNote(ctx: MutationCtx, id: Id<"notes">) {
  const userId = await requireUserId(ctx);
  const note = await ctx.db.get("notes", id);
  if (!note || note.userId !== userId) throw new Error("Note not found");
  return note;
}

export const update = mutation({
  args: {
    id: v.id("notes"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, tags, ...rest }) => {
    const note = await ownNote(ctx, id);
    const now = Date.now();
    const nextTags = tags ? cleanList(tags) : note.tags;
    await ctx.db.patch("notes", id, {
      ...rest,
      ...(tags ? { tags: nextTags } : {}),
      updatedAt: now,
      searchText: makeSearchText(rest.title ?? note.title, rest.body ?? note.body, nextTags),
    });
    // Every update schedules a job so the latest one always runs; unchanged text is skipped.
    await scheduleNoteEmbedding(ctx, id, now);
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    await ownNote(ctx, id);
    await deleteEmbedding(ctx, { noteId: id });
    await ctx.db.delete("notes", id);
  },
});
