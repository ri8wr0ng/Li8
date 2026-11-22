import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deleteEmbedding, scheduleNoteEmbedding } from "./embeddings";
import { cleanList, requireUserId } from "./lib";
import schema from "./schema";
import { vShareRole, type ShareRole } from "./validators";

/** Personal-scale cap; the client indexes these for instant search. */
const MAX_NOTES = 2000;

export function makeSearchText(title: string, body: string, tags: string[]) {
  return [title, body, tags.join(" ")].join(" ");
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("notes")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_NOTES);
  },
});

export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    pinned: v.optional(v.boolean()),
    /** True lists only archived notes; otherwise archived notes are left out. */
    archived: v.optional(v.boolean()),
  },
  returns: paginationResultValidator(schema.doc("notes")),
  handler: async (ctx, { paginationOpts, pinned, archived }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { page: [], isDone: true, continueCursor: "" };
    const flag = archived ? true : undefined;
    const notes =
      pinned === undefined
        ? ctx.db
            .query("notes")
            .withIndex("by_user_archived_updated", (q) =>
              q.eq("userId", userId).eq("archived", flag),
            )
            .order("desc")
        : ctx.db
            .query("notes")
            .withIndex("by_user_archived_pinned_updated", (q) =>
              q.eq("userId", userId).eq("archived", flag).eq("pinned", pinned),
            )
            .order("desc");
    return await notes.paginate(paginationOpts);
  },
});

export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(schema.doc("notes")),
  handler: async (ctx, { query: input, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const text = input.trim().slice(0, 500);
    if (!text) return [];
    const take = Math.max(0, Math.min(50, Math.floor(limit ?? 20)));
    if (take === 0) return [];
    return await ctx.db
      .query("notes")
      .withSearchIndex("search_text", (q) => q.search("searchText", text).eq("userId", userId))
      .take(take);
  },
});

export const backfillSearchText = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const batch = await ctx.db.query("notes").paginate({ numItems: 200, cursor });
    for (const note of batch.page) {
      if (note.searchText === undefined) {
        await ctx.db.patch("notes", note._id, {
          searchText: makeSearchText(note.title, note.body, note.tags),
        });
      }
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.notes.backfillSearchText, {
        cursor: batch.continueCursor,
      });
    }
    return null;
  },
});

export type NoteRole = "owner" | ShareRole;

/** What `userId` may do with `note`: own it, edit it, view it, or nothing (null). */
export async function noteRole(
  ctx: QueryCtx,
  note: Doc<"notes">,
  userId: Id<"users"> | null,
): Promise<NoteRole | null> {
  if (userId === null) return null;
  if (note.userId === userId) return "owner";
  const share = await ctx.db
    .query("noteShares")
    .withIndex("by_note_user", (q) => q.eq("noteId", note._id).eq("userId", userId))
    .unique();
  return share?.role ?? null;
}

/** The public link token is the owner's to hand out, so other people don't get it. */
function forRole(note: Doc<"notes">, role: NoteRole): Doc<"notes"> {
  if (role === "owner") return note;
  const { publicId: _publicId, ...rest } = note;
  return rest;
}

export const get = query({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const note = await ctx.db.get("notes", id);
    if (!note) return null;
    const role = await noteRole(ctx, note, userId);
    return role ? forRole(note, role) : null;
  },
});

/** The caller's role on a note and who owns it, for the editor's read-only and share UI. */
export const access = query({
  args: { id: v.id("notes") },
  returns: v.union(
    v.null(),
    v.object({
      role: v.union(v.literal("owner"), vShareRole),
      ownerName: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const note = await ctx.db.get("notes", id);
    if (!note) return null;
    const role = await noteRole(ctx, note, userId);
    if (!role) return null;
    const owner = await ctx.db.get("users", note.userId);
    return { role, ownerName: owner?.name ?? owner?.email ?? null };
  },
});

/** Shared with the AI assistant's createNote tool. */
export async function insertNote(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { title?: string; body?: string; tags?: string[] },
) {
  const now = Date.now();
  const title = args.title?.trim() ?? "";
  const body = args.body ?? "";
  const tags = cleanList(args.tags ?? []);
  const id = await ctx.db.insert("notes", {
    userId,
    title,
    body,
    tags,
    pinned: false,
    updatedAt: now,
    searchText: makeSearchText(title, body, tags),
  });
  if (args.title?.trim() || args.body?.trim() || args.tags?.length)
    await scheduleNoteEmbedding(ctx, id, now);
  return id;
}

export const create = mutation({
  args: { title: v.optional(v.string()), body: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await insertNote(ctx, userId, args);
  },
});

async function ownNote(ctx: MutationCtx, id: Id<"notes">) {
  const userId = await requireUserId(ctx);
  const note = await ctx.db.get("notes", id);
  if (!note || note.userId !== userId) throw new Error("Note not found");
  return note;
}

export const update = mutation({
  args: {
    id: v.id("notes"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, tags, pinned, ...rest }) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get("notes", id);
    const role = note && (await noteRole(ctx, note, userId));
    if (!note || !role) throw new Error("Note not found");
    if (role === "view") throw new Error("You can only view this note");
    // Pinning places the note in the owner's list, so only the owner can do it.
    if (pinned !== undefined && role !== "owner") throw new Error("Only the owner can pin");
    const now = Date.now();
    const nextTags = tags ? cleanList(tags) : note.tags;
    await ctx.db.patch("notes", id, {
      ...rest,
      ...(tags ? { tags: nextTags } : {}),
      ...(pinned !== undefined ? { pinned } : {}),
      updatedAt: now,
      searchText: makeSearchText(rest.title ?? note.title, rest.body ?? note.body, nextTags),
    });
    // Every update schedules a job so the latest one always runs; unchanged text is skipped.
    await scheduleNoteEmbedding(ctx, id, now);
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    await ownNote(ctx, id);
    await deleteEmbedding(ctx, { noteId: id });
    const shares = await ctx.db
      .query("noteShares")
      .withIndex("by_note_user", (q) => q.eq("noteId", id))
      .take(MAX_SHARES);
    for (const share of shares) await ctx.db.delete("noteShares", share._id);
    await ctx.db.delete("notes", id);
  },
});

/** Copy a note you can read into your own notes. Returns the copy's id. */
export const duplicate = mutation({
  args: { id: v.id("notes") },
  returns: v.id("notes"),
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get("notes", id);
    if (!note || !(await noteRole(ctx, note, userId))) throw new Error("Note not found");
    const title = note.title.trim() ? `${note.title.trim()} (copy)` : "";
    return await insertNote(ctx, userId, { title, body: note.body, tags: note.tags });
  },
});

/** Archiving hides a note from the main list without deleting it. It doesn't count as an edit. */
export const setArchived = mutation({
  args: { id: v.id("notes"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { id, archived }) => {
    await ownNote(ctx, id);
    await ctx.db.patch("notes", id, { archived: archived ? true : undefined });
    return null;
  },
});

// ---- Sharing ----

const MAX_SHARES = 50;

const vShareRow = v.object({
  userId: v.id("users"),
  name: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  role: vShareRole,
});

/** Who the owner has shared a note with, and its public link token. Owner only. */
export const shares = query({
  args: { id: v.id("notes") },
  returns: v.union(
    v.null(),
    v.object({ publicId: v.union(v.string(), v.null()), people: v.array(vShareRow) }),
  ),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const note = await ctx.db.get("notes", id);
    if (!note || note.userId !== userId) return null;
    const rows = await ctx.db
      .query("noteShares")
      .withIndex("by_note_user", (q) => q.eq("noteId", id))
      .take(MAX_SHARES);
    const people = await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db.get("users", row.userId);
        return {
          userId: row.userId,
          name: user?.name ?? null,
          email: user?.email ?? null,
          role: row.role,
        };
      }),
    );
    return { publicId: note.publicId ?? null, people };
  },
});

async function userByEmail(ctx: MutationCtx, raw: string) {
  const email = raw.trim();
  if (!email) return null;
  for (const candidate of new Set([email, email.toLowerCase()])) {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", candidate))
      .first();
    if (user) return user;
  }
  return null;
}

/** Share a note with someone by their account email, or change their role. Owner only. */
export const share = mutation({
  args: { id: v.id("notes"), email: v.string(), role: vShareRole },
  returns: v.null(),
  handler: async (ctx, { id, email, role }) => {
    const note = await ownNote(ctx, id);
    const user = await userByEmail(ctx, email);
    if (!user) throw new ConvexError("No li8 account uses that email");
    if (user._id === note.userId) throw new ConvexError("You already own this note");
    const existing = await ctx.db
      .query("noteShares")
      .withIndex("by_note_user", (q) => q.eq("noteId", id).eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch("noteShares", existing._id, { role });
      return null;
    }
    const current = await ctx.db
      .query("noteShares")
      .withIndex("by_note_user", (q) => q.eq("noteId", id))
      .take(MAX_SHARES);
    if (current.length >= MAX_SHARES) {
      throw new ConvexError(`A note can be shared with up to ${MAX_SHARES} people`);
    }
    await ctx.db.insert("noteShares", { noteId: id, ownerId: note.userId, userId: user._id, role });
    return null;
  },
});

/** Stop sharing with someone. The owner can remove anyone; others can remove themselves. */
export const unshare = mutation({
  args: { id: v.id("notes"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { id, userId }) => {
    const me = await requireUserId(ctx);
    const note = await ctx.db.get("notes", id);
    if (!note || (note.userId !== me && userId !== me)) throw new Error("Note not found");
    const row = await ctx.db
      .query("noteShares")
      .withIndex("by_note_user", (q) => q.eq("noteId", id).eq("userId", userId))
      .unique();
    if (row) await ctx.db.delete("noteShares", row._id);
    return null;
  },
});

/** Turn the public read-only link on or off. Turning it off and on again makes a new link. */
export const setPublic = mutation({
  args: { id: v.id("notes"), enabled: v.boolean() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { id, enabled }) => {
    const note = await ownNote(ctx, id);
    if (!enabled) {
      await ctx.db.patch("notes", id, { publicId: undefined });
      return null;
    }
    if (note.publicId) return note.publicId;
    const publicId = crypto.randomUUID().replaceAll("-", "");
    await ctx.db.patch("notes", id, { publicId });
    return publicId;
  },
});

/** A note behind a public link. Needs no sign-in. */
export const getPublic = query({
  args: { publicId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      body: v.string(),
      tags: v.array(v.string()),
      updatedAt: v.number(),
      ownerName: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { publicId }) => {
    if (!publicId) return null;
    const note = await ctx.db
      .query("notes")
      .withIndex("by_public_id", (q) => q.eq("publicId", publicId))
      .unique();
    if (!note) return null;
    const owner = await ctx.db.get("users", note.userId);
    return {
      title: note.title,
      body: note.body,
      tags: note.tags,
      updatedAt: note.updatedAt,
      ownerName: owner?.name ?? null,
    };
  },
});

/** Notes other people have shared with the caller, newest edit first. */
export const sharedWithMe = query({
  args: {},
  returns: v.array(
    v.object({
      note: schema.doc("notes"),
      role: vShareRole,
      ownerName: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("noteShares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    const out = [];
    for (const row of rows) {
      const note = await ctx.db.get("notes", row.noteId);
      if (!note) continue;
      const owner = await ctx.db.get("users", row.ownerId);
      out.push({
        note: forRole(note, row.role),
        role: row.role,
        ownerName: owner?.name ?? owner?.email ?? null,
      });
    }
    return out.toSorted((a, b) => b.note.updatedAt - a.note.updatedAt);
  },
});
