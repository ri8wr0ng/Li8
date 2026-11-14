import { getAuthUserId } from "@convex-dev/auth/server";
import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

const vGoogleMethod = v.object({ name: v.literal("google"), profile: vGoogleProfile });

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
    return { id: user._id, name: user.name ?? null, email: user.email ?? null };
  },
});
