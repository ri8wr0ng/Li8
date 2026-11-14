import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { vSeriesKind, vSeriesStatus } from "./validators";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }),

  notes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    tags: v.array(v.string()),
    pinned: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user_updated", ["userId", "updatedAt"]),

  series: defineTable({
    userId: v.id("users"),
    title: v.string(),
    altNames: v.array(v.string()),
    kind: vSeriesKind,
    status: vSeriesStatus,
    chapter: v.number(),
    totalChapters: v.optional(v.number()),
    description: v.string(),
    genres: v.array(v.string()),
    // e.g. "https://example.com/read/btth/chapter-{n}"
    readUrlTemplate: v.optional(v.string()),
    // AniList media id, when the series was filled in from AniList. No cover art is stored.
    anilistId: v.optional(v.number()),
    lastReadAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_updated", ["userId", "updatedAt"]),

  chapterHistory: defineTable({
    userId: v.id("users"),
    seriesId: v.id("series"),
    chapter: v.number(),
    at: v.number(),
  }).index("by_series_at", ["seriesId", "at"]),
});
