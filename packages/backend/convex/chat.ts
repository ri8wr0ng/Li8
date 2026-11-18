import {
  getThreadMetadata,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
  createThread,
} from "@convex-dev/agent";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, mutation, query, type QueryCtx } from "./_generated/server";
import { assistant, instructions } from "./agent";
import { aiAllowedFor, requireAiFor } from "./aiModels";
import { requireUserId } from "./lib";
import { limitAi } from "./rateLimits";
import { vPageRef } from "./validators";

const MAX_PROMPT = 4000;

/** Returns the thread if it belongs to the signed-in user, otherwise null. */
async function ownThread(ctx: QueryCtx, threadId: string) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  try {
    const thread = await getThreadMetadata(ctx, components.agent, { threadId });
    return thread.userId === userId ? { thread, userId } : null;
  } catch {
    return null;
  }
}

export const threads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const result = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId,
      order: "desc",
      paginationOpts: { numItems: 50, cursor: null },
    });
    return result.page.map((t) => ({
      id: t._id,
      title: t.title ?? "New chat",
      createdAt: t._creationTime,
    }));
  },
});

export const messages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator, streamArgs: vStreamArgs },
  handler: async (ctx, args) => {
    const owned = await ownThread(ctx, args.threadId);
    if (!owned) {
      return { page: [], isDone: true, continueCursor: "", streams: undefined };
    }
    const paginated = await listUIMessages(ctx, components.agent, args);
    const streams = await syncStreams(ctx, components.agent, args);
    return { ...paginated, streams };
  },
});

/** Send a message, starting a new thread when none is given. Returns the thread id. */
export const send = mutation({
  args: { threadId: v.optional(v.string()), prompt: v.string(), page: v.optional(vPageRef) },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    await requireAiFor(ctx, userId);
    const prompt = args.prompt.trim();
    if (!prompt) throw new ConvexError("Type a message first.");
    if (prompt.length > MAX_PROMPT) throw new ConvexError("That message is too long.");
    await limitAi(ctx, "chat", userId);

    let threadId = args.threadId;
    if (threadId) {
      if (!(await ownThread(ctx, threadId))) throw new ConvexError("Chat not found.");
    } else {
      threadId = await createThread(ctx, components.agent, { userId, title: titleFrom(prompt) });
    }
    const { messageId } = await saveMessage(ctx, components.agent, { threadId, userId, prompt });
    await ctx.scheduler.runAfter(0, internal.chat.respond, {
      threadId,
      userId,
      promptMessageId: messageId,
      page: args.page,
    });
    return threadId;
  },
});

function titleFrom(prompt: string) {
  const line = prompt.split("\n")[0].trim();
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}

export const respond = internalAction({
  args: {
    threadId: v.string(),
    userId: v.id("users"),
    promptMessageId: v.string(),
    page: v.optional(vPageRef),
  },
  handler: async (ctx, { threadId, userId, promptMessageId, page }) => {
    // pageContext checks ownership; a page that isn't the user's is ignored.
    const pageText = page
      ? await ctx.runQuery(internal.assistantData.pageContext, { userId, page })
      : null;
    const result = await assistant.streamText(
      ctx,
      { threadId, userId },
      { promptMessageId, instructions: instructions(new Date(), pageText) },
      { saveStreamDeltas: { chunking: "word", throttleMs: 100 } },
    );
    await result.consumeStream();
  },
});

export const remove = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    if (!(await ownThread(ctx, threadId))) throw new ConvexError("Chat not found.");
    await assistant.deleteThreadAsync(ctx, { threadId });
  },
});

/** Whether AI is configured and allowed for the signed-in user, so the client can hide it otherwise. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return { enabled: userId !== null && (await aiAllowedFor(ctx, userId)) };
  },
});
