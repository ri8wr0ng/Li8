import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { filter } from "convex-helpers/server/filter";
import { query } from "./_generated/server";
import schema from "./schema";
import { vSeriesKind, vSeriesStatus } from "./validators";

export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(vSeriesStatus),
    /** Any of these kinds. Empty or missing means every kind. */
    kinds: v.optional(v.array(vSeriesKind)),
    /** Has at least one of these labels. Empty or missing means no label filter. */
    labelIds: v.optional(v.array(v.id("labels"))),
  },
  returns: paginationResultValidator(schema.doc("series")),
  handler: async (ctx, { paginationOpts, status, kinds, labelIds }) => {
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

    const kindSet = kinds && kinds.length > 0 ? new Set<string>(kinds) : null;
    const labelSet = labelIds && labelIds.length > 0 ? new Set<string>(labelIds) : null;
    if (!kindSet && !labelSet) return await baseQuery.paginate(paginationOpts);

    const filtered = filter(baseQuery, (doc) => {
      if (kindSet && !kindSet.has(doc.kind)) return false;
      if (labelSet && !(doc.labelIds ?? []).some((id) => labelSet.has(id))) return false;
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
