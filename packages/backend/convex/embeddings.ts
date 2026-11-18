import { getAuthUserId } from "@convex-dev/auth/server";
import { embed, embedMany } from "ai";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  aiAllowedFor,
  aiEnabled,
  embeddingModel,
  noteText,
  requireAi,
  seriesText,
  textHash,
} from "./aiModels";
import { requireUserId } from "./lib";
import { recordEmbedding } from "./usage";
import { limitAi } from "./rateLimits";

/** Wait for typing to settle before embedding a note. */
const NOTE_EMBED_DELAY_MS = 15_000;
const BACKFILL_BATCH = 40;

type Target = { noteId: Id<"notes"> } | { seriesId: Id<"series"> };
type Pending = Target & { userId: Id<"users">; text: string; hash: string };

const vTarget = { noteId: v.optional(v.id("notes")), seriesId: v.optional(v.id("series")) };

// ---------------------------------------------------------------------------
// Called from notes.ts / series.ts mutations

/** Queue (re-)embedding after a note changes. Only the job from the latest edit does any work. */
export async function scheduleNoteEmbedding(ctx: MutationCtx, noteId: Id<"notes">, at: number) {
  const note = await ctx.db.get("notes", noteId);
  if (!note || !(await aiAllowedFor(ctx, note.userId))) return;
  await ctx.scheduler.runAfter(NOTE_EMBED_DELAY_MS, internal.embeddings.embedOne, { noteId, at });
}

export async function scheduleSeriesEmbedding(ctx: MutationCtx, seriesId: Id<"series">) {
  const series = await ctx.db.get("series", seriesId);
  if (!series || !(await aiAllowedFor(ctx, series.userId))) return;
  await ctx.scheduler.runAfter(2_000, internal.embeddings.embedOne, { seriesId });
}

export async function deleteEmbedding(ctx: MutationCtx, target: Target) {
  const existing = await findEmbedding(ctx, target);
  if (existing) await ctx.db.delete("embeddings", existing._id);
}

async function findEmbedding(ctx: QueryCtx, target: Target) {
  return "noteId" in target
    ? await ctx.db
        .query("embeddings")
        .withIndex("by_note", (q) => q.eq("noteId", target.noteId))
        .unique()
    : await ctx.db
        .query("embeddings")
        .withIndex("by_series", (q) => q.eq("seriesId", target.seriesId))
        .unique();
}

/** What to embed for a note or series, or null when its stored embedding is current. */
async function pendingFor(
  ctx: QueryCtx,
  doc: Doc<"notes"> | Doc<"series">,
): Promise<Pending | null> {
  // Only embed for users who may use AI.
  if (!(await aiAllowedFor(ctx, doc.userId))) return null;
  const isNote = "body" in doc;
  const target: Target = isNote ? { noteId: doc._id } : { seriesId: doc._id };
  const text = isNote ? noteText(doc) : seriesText(doc);
  const hash = textHash(text);
  const existing = await findEmbedding(ctx, target);
  if (existing?.hash === hash) return null;
  return { ...target, userId: doc.userId, text, hash };
}

// ---------------------------------------------------------------------------
// Embedding one document

export const pendingOne = internalQuery({
  args: { ...vTarget, at: v.optional(v.number()) },
  handler: async (ctx, { noteId, seriesId, at }): Promise<Pending | null> => {
    const doc = noteId
      ? await ctx.db.get("notes", noteId)
      : seriesId
        ? await ctx.db.get("series", seriesId)
        : null;
    if (!doc) return null;
    // A later edit scheduled its own job.
    if (at !== undefined && doc.updatedAt > at) return null;
    return await pendingFor(ctx, doc);
  },
});

export const embedOne = internalAction({
  args: { ...vTarget, at: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!aiEnabled()) return;
    const pending = await ctx.runQuery(internal.embeddings.pendingOne, args);
    if (!pending) return;
    const { text, ...item } = pending;
    if (!text.trim()) {
      await ctx.runMutation(internal.embeddings.save, { items: [{ ...item, embedding: null }] });
      return;
    }
    const result = await embed({ model: embeddingModel, value: text });
    await recordEmbedding(ctx, item.userId, "index", result);
    await ctx.runMutation(internal.embeddings.save, {
      items: [{ ...item, embedding: result.embedding }],
    });
  },
});

export const save = internalMutation({
  args: {
    items: v.array(
      v.object({
        ...vTarget,
        userId: v.id("users"),
        hash: v.string(),
        // null clears the embedding (e.g. the note is now empty).
        embedding: v.union(v.array(v.float64()), v.null()),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    for (const { noteId, seriesId, userId, hash, embedding } of items) {
      const target: Target | null = noteId ? { noteId } : seriesId ? { seriesId } : null;
      if (!target) continue;
      // The document may have been deleted while we were embedding it.
      const doc = noteId
        ? await ctx.db.get("notes", noteId)
        : await ctx.db.get("series", seriesId!);
      const existing = await findEmbedding(ctx, target);
      if (!doc || embedding === null) {
        if (existing) await ctx.db.delete("embeddings", existing._id);
        continue;
      }
      if (existing) await ctx.db.patch("embeddings", existing._id, { hash, embedding });
      else await ctx.db.insert("embeddings", { userId, ...target, hash, embedding });
    }
  },
});

// ---------------------------------------------------------------------------
// Backfill: index everything a user already has (first run, or after enabling AI)

export const reindexMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    if (!(await aiAllowedFor(ctx, userId))) return;
    await ctx.scheduler.runAfter(0, internal.embeddings.backfill, {
      userId,
      kind: "notes" as const,
      cursor: null,
    });
  },
});

export const staleBatch = internalQuery({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("notes"), v.literal("series")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { userId, kind, paginationOpts }) => {
    const result = await ctx.db
      .query(kind)
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts);
    const items: Pending[] = [];
    for (const doc of result.page) {
      const pending = await pendingFor(ctx, doc);
      if (pending) items.push(pending);
    }
    return { items, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const backfill = internalAction({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("notes"), v.literal("series")),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { userId, kind, cursor }) => {
    if (!aiEnabled()) return;
    const batch = await ctx.runQuery(internal.embeddings.staleBatch, {
      userId,
      kind,
      paginationOpts: { numItems: BACKFILL_BATCH, cursor },
    });
    const withText = batch.items.filter((i) => i.text.trim());
    // Now-empty documents: drop their old embedding.
    const items: {
      noteId?: Id<"notes">;
      seriesId?: Id<"series">;
      userId: Id<"users">;
      hash: string;
      embedding: number[] | null;
    }[] = batch.items
      .filter((i) => !i.text.trim())
      .map(({ text: _text, ...item }) => ({ ...item, embedding: null }));
    if (withText.length) {
      const result = await embedMany({
        model: embeddingModel,
        values: withText.map((i) => i.text),
      });
      await recordEmbedding(ctx, userId, "index", result);
      const { embeddings } = result;
      items.push(
        ...withText.map(({ text: _text, ...item }, i) => ({ ...item, embedding: embeddings[i] })),
      );
    }
    if (items.length) await ctx.runMutation(internal.embeddings.save, { items });
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.embeddings.backfill, {
        userId,
        kind,
        cursor: batch.continueCursor,
      });
    } else if (kind === "notes") {
      await ctx.scheduler.runAfter(0, internal.embeddings.backfill, {
        userId,
        kind: "series" as const,
        cursor: null,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Search by meaning

export type MeaningHit =
  | { kind: "note"; score: number; note: Doc<"notes"> }
  | { kind: "series"; score: number; series: Doc<"series"> };

export const hydrate = internalQuery({
  args: {
    userId: v.id("users"),
    hits: v.array(v.object({ id: v.id("embeddings"), score: v.number() })),
  },
  handler: async (ctx, { userId, hits }): Promise<MeaningHit[]> => {
    const out: MeaningHit[] = [];
    for (const { id, score } of hits) {
      const row = await ctx.db.get("embeddings", id);
      if (!row || row.userId !== userId) continue;
      if (row.noteId) {
        const note = await ctx.db.get("notes", row.noteId);
        if (note && note.userId === userId) out.push({ kind: "note", score, note });
      } else if (row.seriesId) {
        const series = await ctx.db.get("series", row.seriesId);
        if (series && series.userId === userId) out.push({ kind: "series", score, series });
      }
    }
    return out;
  },
});

/** The signed-in user (auth carries over from the calling action) and whether they may use AI. */
export const viewer = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ userId: Id<"users"> | null; allowed: boolean }> => {
    const userId = await getAuthUserId(ctx);
    return { userId, allowed: userId !== null && (await aiAllowedFor(ctx, userId)) };
  },
});

/** Below this cosine similarity, results are mostly noise for text-embedding-3-small. */
const MIN_SCORE = 0.25;

export async function searchByMeaningFor(
  ctx: ActionCtx,
  userId: Id<"users">,
  query: string,
  limit = 10,
): Promise<MeaningHit[]> {
  const result = await embed({ model: embeddingModel, value: query });
  await recordEmbedding(ctx, userId, "search", result);
  const { embedding } = result;
  const results = await ctx.vectorSearch("embeddings", "by_embedding", {
    vector: embedding,
    limit,
    filter: (q) => q.eq("userId", userId),
  });
  const hits = results
    .filter((r) => r._score >= MIN_SCORE)
    .map((r) => ({ id: r._id, score: r._score }));
  if (!hits.length) return [];
  return await ctx.runQuery(internal.embeddings.hydrate, { userId, hits });
}

/** Include owned documents so semantic matches don't depend on keyword results. */
export const search = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<MeaningHit[]> => {
    requireAi();
    const { userId, allowed } = await ctx.runQuery(internal.embeddings.viewer, {});
    if (userId === null) throw new Error("Not signed in");
    if (!allowed) throw new ConvexError("AI isn't available on your account yet.");
    const q = query.trim().slice(0, 500);
    if (!q) return [];
    await limitAi(ctx, "search", userId);
    return await searchByMeaningFor(ctx, userId, q, 12);
  },
});
