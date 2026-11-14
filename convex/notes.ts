import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deleteEmbedding, scheduleNoteEmbedding } from "./embeddings";
import { cleanList, requireUserId } from "./lib";

/** Personal-scale cap; the client indexes these for instant search. */
const MAX_NOTES = 2000;

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
  const id = await ctx.db.insert("notes", {
    userId,
    title: args.title?.trim() ?? "",
    body: args.body ?? "",
    tags: cleanList(args.tags ?? []),
    pinned: false,
    updatedAt: now,
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
    await ownNote(ctx, id);
    const now = Date.now();
    await ctx.db.patch("notes", id, {
      ...rest,
      ...(tags ? { tags: cleanList(tags) } : {}),
      updatedAt: now,
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
