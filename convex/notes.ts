import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

export const create = mutation({
  args: { title: v.optional(v.string()), body: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await ctx.db.insert("notes", {
      userId,
      title: args.title?.trim() ?? "",
      body: args.body ?? "",
      tags: [],
      pinned: false,
      updatedAt: Date.now(),
    });
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
    await ctx.db.patch("notes", id, {
      ...rest,
      ...(tags ? { tags: cleanList(tags) } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    await ownNote(ctx, id);
    await ctx.db.delete("notes", id);
  },
});
