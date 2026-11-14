import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const LIMITS = {
  chat: { kind: "token bucket", rate: 60, period: HOUR, capacity: 15 },
  search: { kind: "token bucket", rate: 200, period: HOUR, capacity: 30 },
} as const;

const rateLimiter = new RateLimiter(components.rateLimiter, LIMITS);

export async function limitAi(
  ctx: MutationCtx | ActionCtx,
  name: "chat" | "search",
  userId: Id<"users">,
) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key: userId });
  if (!ok) {
    const minutes = Math.max(1, Math.ceil(retryAfter / 60_000));
    throw new ConvexError(
      `You've used AI a lot in the last few minutes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
  }
}

/**
 * Each limit's stored value and its refill settings. The client works out
 * what's left right now, since the bucket refills continuously.
 */
export async function limitStatus(ctx: QueryCtx, userId: Id<"users">) {
  const out = [];
  for (const name of ["chat", "search"] as const) {
    const { value, ts } = await rateLimiter.getValue(ctx, name, { key: userId });
    const { rate, period, capacity } = LIMITS[name];
    out.push({ name, value, ts, rate, period, capacity });
  }
  return out;
}
