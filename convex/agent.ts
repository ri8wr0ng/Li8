import { Agent, createTool, stepCountIs, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { chatModel } from "./aiModels";
import { seriesSummary } from "./assistantData";
import { searchByMeaningFor } from "./embeddings";
import { reportedCost } from "./usage";

const KINDS = ["manga", "manhwa", "manhua", "webtoon", "novel", "other"] as const;
const STATUSES = ["reading", "planned", "on_hold", "completed", "dropped"] as const;

function userOf(ctx: ToolCtx): Id<"users"> {
  if (!ctx.userId) throw new Error("This conversation has no owner.");
  return ctx.userId as Id<"users">;
}

const search = createTool({
  description:
    "Search the user's notes and Library by meaning (not just keywords). Use it to find a series before changing its chapter, to answer questions about notes, or when the user describes something vaguely.",
  inputSchema: z.object({
    query: z.string().describe("What to look for, in natural language. Include alternative names if known."),
  }),
  execute: async (ctx, { query }) => {
    const hits = await searchByMeaningFor(ctx, userOf(ctx), query, 8);
    if (!hits.length) return { results: [], hint: "Nothing matched. Try listLibrary, or other wording." };
    return {
      results: hits.map((h) =>
        h.kind === "note"
          ? {
              type: "note" as const,
              id: h.note._id,
              title: h.note.title || "Untitled",
              tags: h.note.tags,
              excerpt: h.note.body.slice(0, 600),
              score: Number(h.score.toFixed(3)),
            }
          : { type: "series" as const, ...seriesSummary(h.series), score: Number(h.score.toFixed(3)) },
      ),
    };
  },
});

const listLibrary = createTool({
  description:
    "List series in the user's Library with their current chapter, most recently updated first. Optionally filter by status.",
  inputSchema: z.object({ status: z.enum(STATUSES).optional() }),
  execute: async (ctx, { status }): Promise<unknown> => {
    return await ctx.runQuery(internal.assistantData.listLibrary, { userId: userOf(ctx), status });
  },
});

const readNote = createTool({
  description: "Read the full text of one note by id (ids come from search results).",
  inputSchema: z.object({ noteId: z.string() }),
  execute: async (ctx, { noteId }): Promise<unknown> => {
    return await ctx.runQuery(internal.assistantData.readNote, { userId: userOf(ctx), noteId });
  },
});

const updateChapter = createTool({
  description:
    "Set the chapter the user has read up to for a series, or change it by a delta (e.g. +1). Find the series id with search or listLibrary first.",
  inputSchema: z.object({
    seriesId: z.string(),
    chapter: z.number().min(0).optional().describe("New chapter number; decimals allowed (e.g. 120.5)."),
    delta: z.number().optional().describe("Relative change instead of a chapter number, e.g. 1 or -2."),
  }),
  execute: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(internal.assistantData.updateChapter, { userId: userOf(ctx), ...args });
  },
});

const addSeries = createTool({
  description:
    "Add a new series to the Library. Only do this after checking it isn't there already (search or listLibrary).",
  inputSchema: z.object({
    title: z.string(),
    chapter: z.number().min(0).optional(),
    kind: z.enum(KINDS).optional().describe("Manga is Japanese, manhwa Korean, manhua Chinese."),
    status: z.enum(STATUSES).optional(),
    altNames: z.array(z.string()).optional().describe("Short forms and other titles, e.g. BTTH."),
  }),
  execute: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(internal.assistantData.addSeries, { userId: userOf(ctx), ...args });
  },
});

const createNote = createTool({
  description: "Create a new note.",
  inputSchema: z.object({
    title: z.string(),
    body: z.string().describe("Plain text or light Markdown."),
    tags: z.array(z.string()).optional(),
  }),
  execute: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(internal.assistantData.createNote, { userId: userOf(ctx), ...args });
  },
});

const appendToNote = createTool({
  description: "Add text to the end of an existing note, e.g. a new item on a list.",
  inputSchema: z.object({ noteId: z.string(), text: z.string() }),
  execute: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(internal.assistantData.appendToNote, { userId: userOf(ctx), ...args });
  },
});

const updateNote = createTool({
  description:
    "Change a note's title, tags or pinned state, or replace its whole text. Only replace the body when the user asks you to rewrite, reformat or edit the note's text, and keep everything they didn't ask to change.",
  inputSchema: z.object({
    noteId: z.string(),
    title: z.string().optional(),
    tags: z.array(z.string()).optional().describe("The complete new tag list (replaces the old one)."),
    pinned: z.boolean().optional(),
    body: z.string().optional().describe("The complete new note text."),
  }),
  execute: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(internal.assistantData.updateNote, { userId: userOf(ctx), ...args });
  },
});

const updateSeries = createTool({
  description: "Change a series' reading status, alternative names, or total chapter count.",
  inputSchema: z.object({
    seriesId: z.string(),
    status: z.enum(STATUSES).optional(),
    altNames: z.array(z.string()).optional().describe("The complete new list of alternative names."),
    totalChapters: z.number().min(0).optional(),
  }),
  execute: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(internal.assistantData.updateSeries, { userId: userOf(ctx), ...args });
  },
});

export const tools = {
  search,
  listLibrary,
  readNote,
  updateChapter,
  addSeries,
  createNote,
  appendToNote,
  updateNote,
  updateSeries,
};

export function instructions(now: Date, page?: string | null) {
  return `You are the assistant inside Inkmark, a personal notes app with a reading tracker (the Library) for manga, manhwa and manhua. Today is ${now.toISOString().slice(0, 10)}.

- Look things up with tools; never invent notes, series or chapter numbers.
- Chapter updates like "read btth up to 352" or "finished another chapter of solo leveling": find the series (search, or listLibrary), then call updateChapter. "BTTH"-style short forms are usually initials of the title or an alternative name. If more than one series could match, ask which one.
- Only add a series when it isn't in the Library already.
- When you mention a note or series, link it with Markdown: [Title](/notes/ID) or [Title](/library/ID), using ids from tool results.
- After changing something, say what changed in one short sentence (e.g. "Battle Through The Heavens: 348 → 352").
- Be brief. Answer from the user's notes when the question is about them, and say so when the notes don't contain the answer.${page ? `\n\nCurrent page:\n${page}` : ""}`;
}

export const assistant = new Agent(components.agent, {
  name: "Inkmark",
  languageModel: chatModel,
  // Instructions are passed per call (see chat.respond) so they include today's date.
  tools,
  stopWhen: stepCountIs(8),
  // Called once per model step; logged for the Usage tab.
  usageHandler: async (ctx, { userId, usage, providerMetadata, model }) => {
    if (!userId) return;
    const cost = reportedCost(providerMetadata);
    try {
      await ctx.runMutation(internal.usage.record, {
        userId: userId as Id<"users">,
        kind: "chat",
        model,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cost: cost ?? 0,
        estimated: cost === undefined,
      });
    } catch (error) {
      console.error("Couldn't record AI usage", error);
    }
  },
});
