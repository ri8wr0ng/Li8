/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const userA = await t.run((ctx) => ctx.db.insert("users", { name: "Alice" }));
  const userB = await t.run((ctx) => ctx.db.insert("users", { name: "Bob" }));
  return { t, userA, userB };
}

describe("assistantData internal functions", () => {
  it("refreshes indexed note text after assistant appends and replacements", async () => {
    const { t, userA } = await setup();
    const note = await t.mutation(internal.assistantData.createNote, {
      userId: userA,
      title: "Original",
      body: "Oldbody",
      tags: ["Oldtag"],
    });
    await t.mutation(internal.assistantData.appendToNote, {
      userId: userA,
      noteId: note.id,
      text: "Appendedword",
    });
    expect((await t.run((ctx) => ctx.db.get("notes", note.id)))?.searchText).toContain(
      "Appendedword",
    );
    await t.mutation(internal.assistantData.updateNote, {
      userId: userA,
      noteId: note.id,
      title: "Replacement",
      body: "Newbody",
      tags: [" Newtag "],
    });
    expect((await t.run((ctx) => ctx.db.get("notes", note.id)))?.searchText).toBe(
      "Replacement Newbody Newtag",
    );
  });

  it("hydrates semantic-only matches and excludes documents owned by another user", async () => {
    const { t, userA, userB } = await setup();
    const own = await t.mutation(internal.assistantData.createNote, {
      userId: userA,
      title: "Astronomy",
      body: "Galaxies",
    });
    const other = await t.mutation(internal.assistantData.createNote, {
      userId: userB,
      title: "Private",
      body: "Secret",
    });
    const hits = await t.run(async (ctx) => {
      const ownId = await ctx.db.insert("embeddings", {
        userId: userA,
        noteId: own.id,
        hash: "own",
        embedding: [],
      });
      const otherId = await ctx.db.insert("embeddings", {
        userId: userB,
        noteId: other.id,
        hash: "other",
        embedding: [],
      });
      return [
        { id: ownId, score: 0.9 },
        { id: otherId, score: 0.8 },
      ];
    });
    const result = await t.query(internal.embeddings.hydrate, { userId: userA, hits });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "note", note: { _id: own.id, title: "Astronomy" } });
  });

  describe("updateChapter", () => {
    it("updates chapter directly, writes chapterHistory, and returns {from, to}", async () => {
      const { t, userA } = await setup();
      const addRes = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "Nano Machine",
        chapter: 10,
      });
      if ("error" in addRes || !addRes.id) throw new Error("Failed to add series");
      const seriesId = addRes.id;

      const res = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId,
        chapter: 25,
      });

      expect(res).toEqual({
        id: seriesId,
        title: "Nano Machine",
        from: 10,
        to: 25,
      });

      // Check database state
      const series = await t.run((ctx) => ctx.db.get("series", seriesId));
      expect(series?.chapter).toBe(25);

      const history = await t.run((ctx) =>
        ctx.db
          .query("chapterHistory")
          .withIndex("by_series_at", (q) => q.eq("seriesId", seriesId))
          .order("desc")
          .collect(),
      );
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].chapter).toBe(25);
      expect(history[0].userId).toBe(userA);
    });

    it("updates chapter with delta, clamps delta at 0, and writes chapterHistory", async () => {
      const { t, userA } = await setup();
      const addRes = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "Return of the Mount Hua Sect",
        chapter: 50,
      });
      if ("error" in addRes || !addRes.id) throw new Error("Failed to add series");
      const seriesId = addRes.id;

      // Positive delta
      const bumpRes = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId,
        delta: 12,
      });
      expect(bumpRes).toEqual({
        id: seriesId,
        title: "Return of the Mount Hua Sect",
        from: 50,
        to: 62,
      });

      let series = await t.run((ctx) => ctx.db.get("series", seriesId));
      expect(series?.chapter).toBe(62);

      // Negative delta clamping at 0
      const clampRes = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId,
        delta: -100,
      });
      expect(clampRes).toEqual({
        id: seriesId,
        title: "Return of the Mount Hua Sect",
        from: 62,
        to: 0,
      });

      series = await t.run((ctx) => ctx.db.get("series", seriesId));
      expect(series?.chapter).toBe(0);

      const history = await t.run((ctx) =>
        ctx.db
          .query("chapterHistory")
          .withIndex("by_series_at", (q) => q.eq("seriesId", seriesId))
          .order("desc")
          .collect(),
      );
      expect(history[0].chapter).toBe(0);
    });

    it("returns {error} when attempting to update another user's series", async () => {
      const { t, userA, userB } = await setup();
      const addRes = await t.mutation(internal.assistantData.addSeries, {
        userId: userB,
        title: "User B Secret Series",
        chapter: 100,
      });
      if ("error" in addRes || !addRes.id) throw new Error("Failed to add series");
      const seriesId = addRes.id;

      const res = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId,
        chapter: 105,
      });

      expect(res).toEqual({ error: "No series with that id." });

      // Ensure series was not changed
      const series = await t.run((ctx) => ctx.db.get("series", seriesId));
      expect(series?.chapter).toBe(100);
    });

    it("returns {error} for an invalid id string", async () => {
      const { t, userA } = await setup();

      const invalidIdRes = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId: "not-a-valid-id",
        chapter: 5,
      });
      expect(invalidIdRes).toEqual({ error: "No series with that id." });

      // Also test with a valid ID from a different table (notes)
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "A Note",
        body: "Note content",
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      const noteAsSeriesRes = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId: noteRes.id,
        chapter: 5,
      });
      expect(noteAsSeriesRes).toEqual({ error: "No series with that id." });
    });

    it("returns {error} when neither chapter nor delta is given, or when chapter is negative", async () => {
      const { t, userA } = await setup();
      const addRes = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "Test Series",
        chapter: 10,
      });
      if ("error" in addRes || !addRes.id) throw new Error("Failed to add series");
      const seriesId = addRes.id;

      const noArgsRes = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId,
      });
      expect(noArgsRes).toEqual({
        error: "Give a chapter number of 0 or more, or a change like +1.",
      });

      const negativeChapterRes = await t.mutation(internal.assistantData.updateChapter, {
        userId: userA,
        seriesId,
        chapter: -1,
      });
      expect(negativeChapterRes).toEqual({
        error: "Give a chapter number of 0 or more, or a change like +1.",
      });
    });
  });

  describe("readNote", () => {
    it("reads a note owned by the user", async () => {
      const { t, userA } = await setup();
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "Cultivation Stages",
        body: "1. Qi Refinement\n2. Foundation Building",
        tags: ["cultivation", "reference"],
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      const readRes = await t.query(internal.assistantData.readNote, {
        userId: userA,
        noteId: noteRes.id,
      });

      expect(readRes).toMatchObject({
        id: noteRes.id,
        title: "Cultivation Stages",
        tags: ["cultivation", "reference"],
        body: "1. Qi Refinement\n2. Foundation Building",
      });
      expect("updatedAt" in readRes ? typeof readRes.updatedAt : "missing").toBe("string");
    });

    it("returns title as Untitled if note has empty title", async () => {
      const { t, userA } = await setup();
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "",
        body: "Just body",
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      const readRes = await t.query(internal.assistantData.readNote, {
        userId: userA,
        noteId: noteRes.id,
      });
      expect(readRes).toMatchObject({
        id: noteRes.id,
        title: "Untitled",
        body: "Just body",
      });
    });

    it("truncates note body when exceeding MAX_NOTE_CHARS (12,000)", async () => {
      const { t, userA } = await setup();
      const longBody = "x".repeat(15_000);
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "Very Long Note",
        body: longBody,
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      const readRes = await t.query(internal.assistantData.readNote, {
        userId: userA,
        noteId: noteRes.id,
      });
      if ("error" in readRes || !readRes.body) throw new Error("Expected note body");
      expect(readRes.body.startsWith("x".repeat(12_000))).toBe(true);
      expect(readRes.body.endsWith("\n…(truncated)")).toBe(true);
      expect(readRes.body.length).toBe(12_000 + "\n…(truncated)".length);
    });

    it("rejects another user's note", async () => {
      const { t, userA, userB } = await setup();
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userB,
        title: "Bob's Diary",
        body: "Top secret stuff",
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      const readRes = await t.query(internal.assistantData.readNote, {
        userId: userA,
        noteId: noteRes.id,
      });
      expect(readRes).toEqual({ error: "No note with that id." });
    });

    it("returns {error} for an invalid or non-existent note id", async () => {
      const { t, userA } = await setup();
      const readRes = await t.query(internal.assistantData.readNote, {
        userId: userA,
        noteId: "nonexistent-id",
      });
      expect(readRes).toEqual({ error: "No note with that id." });
    });
  });

  describe("appendToNote", () => {
    it("appends text with a newline to an existing note", async () => {
      const { t, userA } = await setup();
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "Reading List",
        body: "1. Martial Peak",
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      const appendRes = await t.mutation(internal.assistantData.appendToNote, {
        userId: userA,
        noteId: noteRes.id,
        text: "2. Apotheosis",
      });

      expect(appendRes).toEqual({
        id: noteRes.id,
        title: "Reading List",
      });

      const note = await t.run((ctx) => ctx.db.get("notes", noteRes.id));
      expect(note?.body).toBe("1. Martial Peak\n2. Apotheosis");
    });

    it("appends to an empty note without a leading newline", async () => {
      const { t, userA } = await setup();
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "Empty Note",
        body: "",
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      await t.mutation(internal.assistantData.appendToNote, {
        userId: userA,
        noteId: noteRes.id,
        text: "First line",
      });

      const note = await t.run((ctx) => ctx.db.get("notes", noteRes.id));
      expect(note?.body).toBe("First line");
    });

    it("trims trailing whitespace before appending with a newline", async () => {
      const { t, userA } = await setup();
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "Spaced Note",
        body: "First line   \n\n",
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      await t.mutation(internal.assistantData.appendToNote, {
        userId: userA,
        noteId: noteRes.id,
        text: "Second line",
      });

      const note = await t.run((ctx) => ctx.db.get("notes", noteRes.id));
      expect(note?.body).toBe("First line\nSecond line");
    });

    it("rejects another user's note", async () => {
      const { t, userA, userB } = await setup();
      const noteRes = await t.mutation(internal.assistantData.createNote, {
        userId: userB,
        title: "Bob's Note",
        body: "Original text",
      });
      if ("error" in noteRes || !noteRes.id) throw new Error("Failed to create note");

      const appendRes = await t.mutation(internal.assistantData.appendToNote, {
        userId: userA,
        noteId: noteRes.id,
        text: "Unauthorized append",
      });

      expect(appendRes).toEqual({ error: "No note with that id." });

      // Note content unchanged
      const note = await t.run((ctx) => ctx.db.get("notes", noteRes.id));
      expect(note?.body).toBe("Original text");
    });

    it("returns {error} for an invalid note id string", async () => {
      const { t, userA } = await setup();
      const appendRes = await t.mutation(internal.assistantData.appendToNote, {
        userId: userA,
        noteId: "invalid-id",
        text: "Some text",
      });
      expect(appendRes).toEqual({ error: "No note with that id." });
    });
  });

  describe("addSeries and createNote", () => {
    it("addSeries creates a doc owned by the given user with chapterHistory if chapter > 0", async () => {
      const { t, userA } = await setup();
      const res = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "The Beginning After The End",
        chapter: 175,
        kind: "webtoon",
        status: "reading",
        altNames: ["TBATE"],
      });

      expect(res).toMatchObject({
        title: "The Beginning After The End",
        chapter: 175,
      });
      if ("error" in res || !res.id) throw new Error("Expected series id");

      const doc = await t.run((ctx) => ctx.db.get("series", res.id));
      expect(doc).not.toBeNull();
      expect(doc?.userId).toBe(userA);
      expect(doc?.title).toBe("The Beginning After The End");
      expect(doc?.chapter).toBe(175);
      expect(doc?.kind).toBe("webtoon");
      expect(doc?.status).toBe("reading");
      expect(doc?.altNames).toEqual(["TBATE"]);

      // Should have created chapterHistory entry because chapter > 0
      const history = await t.run((ctx) =>
        ctx.db
          .query("chapterHistory")
          .withIndex("by_series_at", (q) => q.eq("seriesId", res.id))
          .collect(),
      );
      expect(history.length).toBe(1);
      expect(history[0].chapter).toBe(175);
      expect(history[0].userId).toBe(userA);
    });

    it("addSeries rejects empty title or negative chapter", async () => {
      const { t, userA } = await setup();

      const emptyTitleRes = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "   ",
      });
      expect(emptyTitleRes).toEqual({ error: "A title is required." });

      const negativeChapterRes = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "Valid Title",
        chapter: -5,
      });
      expect(negativeChapterRes).toEqual({ error: "Chapter must be 0 or more." });
    });

    it("createNote creates a doc owned by the given user", async () => {
      const { t, userA } = await setup();
      const res = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "Artifacts Guide",
        body: "High-grade treasures require spirit stones.",
        tags: ["cultivation", "items"],
      });

      expect(res).toMatchObject({
        title: "Artifacts Guide",
      });
      if ("error" in res || !res.id) throw new Error("Expected note id");

      const doc = await t.run((ctx) => ctx.db.get("notes", res.id));
      expect(doc).not.toBeNull();
      expect(doc?.userId).toBe(userA);
      expect(doc?.title).toBe("Artifacts Guide");
      expect(doc?.body).toBe("High-grade treasures require spirit stones.");
      expect(doc?.tags).toEqual(["cultivation", "items"]);
      expect(doc?.pinned).toBe(false);
    });

    it("createNote defaults untitled when title is empty or whitespace", async () => {
      const { t, userA } = await setup();
      const res = await t.mutation(internal.assistantData.createNote, {
        userId: userA,
        title: "   ",
        body: "Body without title",
      });

      expect(res).toMatchObject({
        title: "Untitled",
      });
      if ("error" in res || !res.id) throw new Error("Expected note id");

      const doc = await t.run((ctx) => ctx.db.get("notes", res.id));
      expect(doc?.title).toBe("");
    });
  });

  describe("listLibrary", () => {
    it("filters by status and never returns other users' series", async () => {
      const { t, userA, userB } = await setup();

      // Series for userA
      const s1 = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "Series Reading 1",
        status: "reading",
        chapter: 10,
      });
      const s2 = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "Series Completed 1",
        status: "completed",
        chapter: 100,
      });
      const s3 = await t.mutation(internal.assistantData.addSeries, {
        userId: userA,
        title: "Series Reading 2",
        status: "reading",
        chapter: 25,
      });

      // Series for userB
      const sB1 = await t.mutation(internal.assistantData.addSeries, {
        userId: userB,
        title: "User B Reading Series",
        status: "reading",
        chapter: 50,
      });

      if (
        "error" in s1 ||
        !s1.id ||
        "error" in s2 ||
        !s2.id ||
        "error" in s3 ||
        !s3.id ||
        "error" in sB1 ||
        !sB1.id
      ) {
        throw new Error("Failed to insert test series");
      }

      // Query without status filter for userA
      const allUserA = await t.query(internal.assistantData.listLibrary, {
        userId: userA,
      });
      expect(allUserA.length).toBe(3);
      const userATitles = allUserA.map((s) => s.title);
      expect(userATitles).toContain("Series Reading 1");
      expect(userATitles).toContain("Series Completed 1");
      expect(userATitles).toContain("Series Reading 2");
      expect(userATitles).not.toContain("User B Reading Series");

      // Verify series summary structure
      const first = allUserA[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("altNames");
      expect(first).toHaveProperty("kind");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("chapter");
      expect(first).toHaveProperty("totalChapters");
      expect(first).toHaveProperty("genres");
      expect(first).toHaveProperty("lastReadAt");
      expect(first.lastReadAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Query with status: "reading" for userA
      const readingUserA = await t.query(internal.assistantData.listLibrary, {
        userId: userA,
        status: "reading",
      });
      expect(readingUserA.length).toBe(2);
      expect(readingUserA.every((s) => s.status === "reading")).toBe(true);
      expect(readingUserA.map((s) => s.title)).not.toContain("Series Completed 1");
      expect(readingUserA.map((s) => s.title)).not.toContain("User B Reading Series");

      // Query with status: "completed" for userA
      const completedUserA = await t.query(internal.assistantData.listLibrary, {
        userId: userA,
        status: "completed",
      });
      expect(completedUserA.length).toBe(1);
      expect(completedUserA[0].title).toBe("Series Completed 1");

      // Query with status: "dropped" for userA (none exist)
      const droppedUserA = await t.query(internal.assistantData.listLibrary, {
        userId: userA,
        status: "dropped",
      });
      expect(droppedUserA).toEqual([]);

      // Query for userB returns only userB's series
      const allUserB = await t.query(internal.assistantData.listLibrary, {
        userId: userB,
      });
      expect(allUserB.length).toBe(1);
      expect(allUserB[0].title).toBe("User B Reading Series");
    });
  });
});
