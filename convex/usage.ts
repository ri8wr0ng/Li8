/**
 * AI usage: one row per model call (chat step, embedding batch, search), with
 * tokens and cost, so the Usage tab can show what AI is costing.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, query, type ActionCtx } from "./_generated/server";
import { EMBEDDING_MODEL } from "./aiModels";
import { limitStatus } from "./rateLimits";
import { vUsageKind } from "./validators";

/** text-embedding-3-small list price, used when the provider doesn't report a cost. */
const EMBEDDING_USD_PER_TOKEN = 0.02 / 1_000_000;
const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
/** Personal scale; a heavy month is a few thousand calls. */
const MAX_ROWS = 20_000;

export const record = internalMutation({
  args: {
    userId: v.id("users"),
    kind: vUsageKind,
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cost: v.number(),
    estimated: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", args);
  },
});

/** OpenRouter reports the charged cost in provider metadata when usage accounting is on. */
export function reportedCost(providerMetadata: unknown): number | undefined {
  const usage = (providerMetadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined)?.openrouter?.usage;
  return typeof usage?.cost === "number" && Number.isFinite(usage.cost) ? usage.cost : undefined;
}

/** Log an embedding call. Never throws: usage logging must not break the feature. */
export async function recordEmbedding(
  ctx: ActionCtx,
  userId: Id<"users">,
  kind: "index" | "search",
  result: { usage?: { tokens?: number }; providerMetadata?: unknown },
) {
  const tokens = result.usage?.tokens ?? 0;
  const cost = reportedCost(result.providerMetadata);
  try {
    await ctx.runMutation(internal.usage.record, {
      userId,
      kind,
      model: EMBEDDING_MODEL,
      inputTokens: tokens,
      outputTokens: 0,
      cost: cost ?? tokens * EMBEDDING_USD_PER_TOKEN,
      estimated: cost === undefined,
    });
  } catch (error) {
    console.error("Couldn't record AI usage", error);
  }
}

type Bucket = { calls: number; inputTokens: number; outputTokens: number; cost: number };
const empty = (): Bucket => ({ calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 });
function add(b: Bucket, row: { inputTokens: number; outputTokens: number; cost: number }) {
  b.calls++;
  b.inputTokens += row.inputTokens;
  b.outputTokens += row.outputTokens;
  b.cost += row.cost;
}

/**
 * Totals and a per-day series for the signed-in user. Days are in the
 * client's time zone (tzOffsetMinutes = new Date().getTimezoneOffset()).
 */
export const summary = query({
  args: { days: v.number(), tzOffsetMinutes: v.number() },
  handler: async (ctx, { days: rawDays, tzOffsetMinutes }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const days = Math.min(MAX_DAYS, Math.max(1, Math.floor(rawDays)));
    const offset = Math.max(-14 * 60, Math.min(14 * 60, tzOffsetMinutes)) * 60_000;

    // Start of "today" in the client's zone, then back (days - 1) more days.
    const now = Date.now();
    const todayStart = Math.floor((now - offset) / DAY) * DAY + offset;
    const since = todayStart - (days - 1) * DAY;

    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user", (q) => q.eq("userId", userId).gte("_creationTime", since))
      .take(MAX_ROWS);

    const daily = Array.from({ length: days }, (_, i) => ({ day: since + i * DAY, ...empty() }));
    const total = empty();
    const today = empty();
    const byKind: Record<string, Bucket> = {};
    const byModel: Record<string, Bucket> = {};
    let estimated = false;
    for (const row of rows) {
      const i = Math.min(days - 1, Math.floor((row._creationTime - since) / DAY));
      add(daily[i]!, row);
      add(total, row);
      if (row._creationTime >= todayStart) add(today, row);
      add((byKind[row.kind] ??= empty()), row);
      add((byModel[row.model] ??= empty()), row);
      estimated ||= row.estimated;
    }

    return {
      days,
      daily,
      total,
      today,
      byKind,
      byModel,
      estimated,
      truncated: rows.length === MAX_ROWS,
      limits: await limitStatus(ctx, userId),
    };
  },
});
