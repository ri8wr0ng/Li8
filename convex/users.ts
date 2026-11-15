import { getAuthUserId } from "@convex-dev/auth/server";
import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib";

const vGoogleMethod = v.object({ name: v.literal("google"), profile: vGoogleProfile });

/** Keep in sync with AVATAR_STYLES in src/components/user-avatar.tsx. */
const AVATAR_STYLES = new Set([
  "notionistsNeutral",
  "lorelei",
  "adventurerNeutral",
  "thumbs",
  "shapes",
  "glass",
]);

export const createUser = internalMutation({
  args: { method: vGoogleMethod },
  returns: v.id("users"),
  handler: async (ctx, { method }) => {
    return await ctx.db.insert("users", {
      name: method.profile.name,
      email: method.profile.emailVerified ? method.profile.email : undefined,
    });
  },
});

export const onSignIn = internalMutation({
  args: { method: vGoogleMethod, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { method, userId }) => {
    const user = await ctx.db.get("users", userId);
    if (user && user.name === undefined && method.profile.name !== undefined) {
      await ctx.db.patch("users", userId, { name: method.profile.name });
    }
    return null;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get("users", userId);
    if (user === null) return null;
    return {
      id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      avatarStyle: user.avatarStyle ?? null,
      avatarSeed: user.avatarSeed ?? null,
      joinedAt: user._creationTime,
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    avatarStyle: v.optional(v.string()),
    avatarSeed: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const patch: { name?: string; avatarStyle?: string; avatarSeed?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name can't be empty");
      patch.name = name.slice(0, 80);
    }
    if (args.avatarStyle !== undefined) {
      if (!AVATAR_STYLES.has(args.avatarStyle)) throw new Error("Unknown avatar style");
      patch.avatarStyle = args.avatarStyle;
    }
    if (args.avatarSeed !== undefined) patch.avatarSeed = args.avatarSeed.slice(0, 64);
    await ctx.db.patch("users", userId, patch);
    return null;
  },
});

const CAP = 2000;
const WATCH = new Set(["movie", "tv", "anime", "reality"]);
const DAY = 24 * 60 * 60 * 1000;

/** Totals and recent activity for the profile page. Counts stop at 2000 ("2000+"). */
export const stats = query({
  args: { tzOffsetMinutes: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      notes: v.number(),
      series: v.number(),
      labels: v.number(),
      capped: v.boolean(),
      byStatus: v.record(v.string(), v.number()),
      chapters: v.number(),
      episodes: v.number(),
      /** Progress updates per local day for the last 84 days, oldest first. */
      activity: v.array(v.number()),
      current: v.array(
        v.object({
          id: v.id("series"),
          title: v.string(),
          kind: v.string(),
          chapter: v.number(),
          totalChapters: v.union(v.number(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { tzOffsetMinutes }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .take(CAP);
    const series = await ctx.db
      .query("series")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(CAP);
    const labels = await ctx.db
      .query("labels")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(200);

    const byStatus: Record<string, number> = {};
    let chapters = 0;
    let episodes = 0;
    for (const s of series) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      if (WATCH.has(s.kind)) episodes += s.kind === "movie" ? 0 : s.chapter;
      else chapters += s.chapter;
    }

    // Day buckets in the viewer's zone, ending today.
    const days = 84;
    const offset = tzOffsetMinutes * 60 * 1000;
    const today = Math.floor((Date.now() - offset) / DAY);
    const since = (today - days + 1) * DAY + offset;
    const history = await ctx.db
      .query("chapterHistory")
      .withIndex("by_user_at", (q) => q.eq("userId", userId).gte("at", since))
      .take(CAP);
    const activity = Array.from({ length: days }, () => 0);
    for (const h of history) {
      const index = Math.floor((h.at - offset) / DAY) - (today - days + 1);
      if (index >= 0 && index < days) activity[index] += 1;
    }

    const current = series
      .filter((s) => s.status === "reading")
      .slice(0, 3)
      .map((s) => ({
        id: s._id,
        title: s.title,
        kind: s.kind,
        chapter: s.chapter,
        totalChapters: s.totalChapters ?? null,
      }));

    return {
      notes: notes.length,
      series: series.length,
      labels: labels.length,
      capped: notes.length === CAP || series.length === CAP,
      byStatus,
      chapters,
      episodes,
      activity,
      current,
    };
  },
});
