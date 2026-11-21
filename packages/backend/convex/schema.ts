import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { vSeriesKind, vSeriesLink, vSeriesStatus, vUsageKind } from "./validators";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    // Generated avatar: a DiceBear style and the seed it's drawn from. Unset means the defaults.
    avatarStyle: v.optional(v.string()),
    avatarSeed: v.optional(v.string()),
  }),

  notes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    tags: v.array(v.string()),
    pinned: v.boolean(),
    updatedAt: v.number(),
    searchText: v.optional(v.string()),
  })
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_user_pinned_updated", ["userId", "pinned", "updatedAt"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["userId"],
    }),

  labels: defineTable({
    userId: v.id("users"),
    name: v.string(),
  }).index("by_user_name", ["userId", "name"]),

  series: defineTable({
    userId: v.id("users"),
    title: v.string(),
    altNames: v.array(v.string()),
    kind: vSeriesKind,
    status: vSeriesStatus,
    chapter: v.number(),
    totalChapters: v.optional(v.number()),
    season: v.optional(v.number()),
    totalSeasons: v.optional(v.number()),
    // Last episode watched in each earlier season, set by "Next season" or typed in by hand.
    pastSeasons: v.optional(v.array(v.object({ season: v.number(), chapter: v.number() }))),
    labelIds: v.optional(v.array(v.id("labels"))),
    searchText: v.optional(v.string()),
    description: v.string(),
    genres: v.array(v.string()),
    // Legacy single reading link; superseded by `links` (cleared once links are saved).
    readUrlTemplate: v.optional(v.string()),
    // Reading links ("https://example.com/btth/chapter-{n}") and website links, in order.
    links: v.optional(v.array(vSeriesLink)),
    // AniList media id, when the series was filled in from AniList. No cover art is stored.
    anilistId: v.optional(v.number()),
    lastReadAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_user_status_updated", ["userId", "status", "updatedAt"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["userId"],
    }),

  chapterHistory: defineTable({
    userId: v.id("users"),
    seriesId: v.id("series"),
    season: v.optional(v.number()),
    chapter: v.number(),
    at: v.number(),
  })
    .index("by_series_at", ["seriesId", "at"])
    .index("by_user_at", ["userId", "at"]),

  // One row per AI model call, for the Usage tab. Cost is in US dollars.
  aiUsage: defineTable({
    userId: v.id("users"),
    kind: vUsageKind,
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
    // True when the provider didn't report a cost and it was worked out from list prices.
    estimated: v.boolean(),
  }).index("by_user", ["userId"]),

  // One embedding per note or series, for search by meaning. Kept out of the
  // notes/series documents so lists synced to the client stay small.
  embeddings: defineTable({
    userId: v.id("users"),
    noteId: v.optional(v.id("notes")),
    seriesId: v.optional(v.id("series")),
    // Hash of the embedded text; unchanged text is not re-embedded.
    hash: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_note", ["noteId"])
    .index("by_series", ["seriesId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId"],
    }),
});
