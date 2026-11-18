import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("labels")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(200);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUserId(ctx);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Label name is required");

    const existing = await ctx.db
      .query("labels")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(200);

    const match = existing.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
    if (match) return match._id;

    return await ctx.db.insert("labels", { userId, name: trimmed });
  },
});

export const rename = mutation({
  args: { id: v.id("labels"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const userId = await requireUserId(ctx);
    const label = await ctx.db.get("labels", id);
    if (!label || label.userId !== userId) throw new Error("Label not found");

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Label name is required");

    const existing = await ctx.db
      .query("labels")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(200);

    const duplicate = existing.find(
      (l) => l._id !== id && l.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) throw new Error("Label with this name already exists");

    await ctx.db.patch("labels", id, { name: trimmed });
  },
});

export const remove = mutation({
  args: { id: v.id("labels") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const label = await ctx.db.get("labels", id);
    if (!label || label.userId !== userId) throw new Error("Label not found");

    await ctx.db.delete("labels", id);
    await ctx.runMutation(internal.labels.cleanupReferences, {
      userId,
      id,
      cursor: null,
    });
  },
});

export const cleanupReferences = internalMutation({
  args: { userId: v.id("users"), id: v.id("labels"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { userId, id, cursor }) => {
    const batch = await ctx.db
      .query("series")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .paginate({ numItems: 100, cursor });
    for (const s of batch.page) {
      if (s.labelIds && s.labelIds.includes(id)) {
        await ctx.db.patch("series", s._id, {
          labelIds: s.labelIds.filter((lid) => lid !== id),
        });
      }
    }

    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.labels.cleanupReferences, {
        userId,
        id,
        cursor: batch.continueCursor,
      });
    }
  },
});
