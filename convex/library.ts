import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { filter } from "convex-helpers/server/filter";
import { query } from "./_generated/server";
import schema from "./schema";
import { vSeriesKind, vSeriesStatus } from "./validators";

const READ_KINDS = new Set<string>(["manga", "manhwa", "manhua", "webtoon", "novel", "other"]);

const WATCH_KINDS = new Set<string>(["movie", "tv", "anime", "reality"]);

export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(vSeriesStatus),
    type: v.optional(v.union(v.literal("all"), v.literal("read"), v.literal("watch"), vSeriesKind)),
    labelId: v.optional(v.id("labels")),
  },
  returns: paginationResultValidator(schema.doc("series")),
  handler: async (ctx, { paginationOpts, status, type, labelId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const baseQuery =
      status !== undefined
        ? ctx.db
            .query("series")
            .withIndex("by_user_status_updated", (q) => q.eq("userId", userId).eq("status", status))
            .order("desc")
        : ctx.db
            .query("series")
            .withIndex("by_user_updated", (q) => q.eq("userId", userId))
            .order("desc");

    const filtered = filter(baseQuery, (doc) => {
      if (type !== undefined && type !== "all") {
        if (type === "read") {
          if (!READ_KINDS.has(doc.kind)) return false;
        } else if (type === "watch") {
          if (!WATCH_KINDS.has(doc.kind)) return false;
        } else if (doc.kind !== type) {
          return false;
        }
      }
      if (labelId !== undefined) {
        if (!doc.labelIds || !doc.labelIds.includes(labelId)) {
          return false;
        }
      }
      return true;
    });

    return await filtered.paginate(paginationOpts);
  },
});

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(schema.doc("series")),
  handler: async (ctx, { query: input, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const text = input.trim().slice(0, 500);
    if (!text) return [];
    const take = Math.max(0, Math.min(Math.floor(limit ?? 20), 50));
    if (take === 0) return [];
    return await ctx.db
      .query("series")
      .withSearchIndex("search_text", (q) => q.search("searchText", text).eq("userId", userId))
      .take(take);
  },
});
