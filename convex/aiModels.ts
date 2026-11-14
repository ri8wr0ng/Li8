import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { env, type QueryCtx } from "./_generated/server";

/**
 * All model calls go through OpenRouter, so one key covers chat (Claude) and
 * embeddings (OpenAI). Set it with:
 *   npx convex env set OPENROUTER_API_KEY <key>
 */
const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY ?? "",
  // Shown on openrouter.ai activity and rankings.
  appName: "Inkmark",
  ...(env.SITE_URL ? { appUrl: env.SITE_URL } : {}),
});

export const CHAT_MODEL = "anthropic/claude-haiku-5.5";
export const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // 1536 dimensions

// usage.include makes OpenRouter report each call's cost (see usage.ts).
export const chatModel = openrouter.chat(CHAT_MODEL, { usage: { include: true } });
export const embeddingModel = openrouter.textEmbeddingModel(EMBEDDING_MODEL);

export function aiEnabled() {
  return Boolean(env.OPENROUTER_API_KEY);
}

export function requireAi() {
  if (!aiEnabled()) {
    throw new ConvexError("AI isn't set up on this deployment yet. Set OPENROUTER_API_KEY to turn it on.");
  }
}

/**
 * AI costs money per call, so for now only these accounts can use it.
 * Emails are only stored when Google reports them verified (see users.ts).
 */
const AI_ALLOWED_EMAILS = new Set(["sheikh.arafat.ulla@gmail.com"]);

/** AI is configured and this user may use it. */
export async function aiAllowedFor(ctx: QueryCtx, userId: Id<"users">) {
  if (!aiEnabled()) return false;
  const user = await ctx.db.get("users", userId);
  return Boolean(user?.email && AI_ALLOWED_EMAILS.has(user.email.toLowerCase()));
}

export async function requireAiFor(ctx: QueryCtx, userId: Id<"users">) {
  requireAi();
  if (!(await aiAllowedFor(ctx, userId))) throw new ConvexError("AI isn't available on your account yet.");
}

const MAX_EMBED_CHARS = 8000;

export function noteText(note: Pick<Doc<"notes">, "title" | "body" | "tags">) {
  const tags = note.tags.map((t) => `#${t}`).join(" ");
  return [note.title.trim(), tags, note.body.trim()].filter(Boolean).join("\n\n").slice(0, MAX_EMBED_CHARS);
}

export function seriesText(
  series: Pick<Doc<"series">, "title" | "altNames" | "kind" | "genres" | "description">,
) {
  return [
    series.title,
    series.altNames.length ? `Also known as: ${series.altNames.join(", ")}` : "",
    [series.kind, ...series.genres].join(", "),
    series.description.trim(),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_EMBED_CHARS);
}

/** FNV-1a; cheap and deterministic, so queries can tell whether text changed. */
export function textHash(text: string) {
  let h = 0x811c9dc5;
  const input = `${EMBEDDING_MODEL}\n${text}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}-${input.length}`;
}
