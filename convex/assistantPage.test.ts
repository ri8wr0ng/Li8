/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const alice = await t.run((ctx) => ctx.db.insert("users", { name: "Alice" }));
  const bob = await t.run((ctx) => ctx.db.insert("users", { name: "Bob" }));
  const note = await t.mutation(internal.assistantData.createNote, {
    userId: alice,
    title: "Cultivation ranks",
    body: "Qi Condensation\nFoundation Establishment",
    tags: ["btth"],
  });
  const series = await t.mutation(internal.assistantData.addSeries, {
    userId: alice,
    title: "Battle Through The Heavens",
    chapter: 348,
  });
  if ("error" in series) throw new Error(series.error);
  return { t, alice, bob, noteId: note.id, seriesId: series.id };
}

describe("pageContext", () => {
  it("describes the owner's open note, including its text", async () => {
    const { t, alice, noteId } = await setup();
    const text = await t.query(internal.assistantData.pageContext, {
      userId: alice,
      page: { kind: "note", id: noteId },
    });
    expect(text).toContain(`noteId ${noteId}`);
    expect(text).toContain("Title: Cultivation ranks");
    expect(text).toContain("Tags: btth");
    expect(text).toContain("Foundation Establishment");
  });

  it("describes the owner's open series", async () => {
    const { t, alice, seriesId } = await setup();
    const text = await t.query(internal.assistantData.pageContext, {
      userId: alice,
      page: { kind: "series", id: seriesId },
    });
    expect(text).toContain(`seriesId ${seriesId}`);
    expect(text).toContain('"chapter":348');
  });

  it("returns nothing for someone else's page", async () => {
    const { t, bob, noteId, seriesId } = await setup();
    expect(
      await t.query(internal.assistantData.pageContext, {
        userId: bob,
        page: { kind: "note", id: noteId },
      }),
    ).toBeNull();
    expect(
      await t.query(internal.assistantData.pageContext, {
        userId: bob,
        page: { kind: "series", id: seriesId },
      }),
    ).toBeNull();
  });

  it("truncates long notes", async () => {
    const { t, alice } = await setup();
    const { id } = await t.mutation(internal.assistantData.createNote, {
      userId: alice,
      title: "Long",
      body: "x".repeat(10_000),
    });
    const text = await t.query(internal.assistantData.pageContext, {
      userId: alice,
      page: { kind: "note", id },
    });
    expect(text).toContain("truncated; use readNote");
    expect(text!.length).toBeLessThan(7_000);
  });
});

describe("updateNote", () => {
  it("changes only the fields given and cleans tags", async () => {
    const { t, alice, noteId } = await setup();
    const res = await t.mutation(internal.assistantData.updateNote, {
      userId: alice,
      noteId,
      tags: [" btth ", "Ranks", "ranks", ""],
      pinned: true,
    });
    expect(res).toMatchObject({
      id: noteId,
      title: "Cultivation ranks",
      changed: ["tags", "pinned"],
    });
    const note = await t.run((ctx) => ctx.db.get("notes", noteId));
    expect(note).toMatchObject({
      title: "Cultivation ranks",
      tags: ["btth", "Ranks"],
      pinned: true,
    });
    expect(note!.body).toBe("Qi Condensation\nFoundation Establishment");
  });

  it("replaces the body when asked", async () => {
    const { t, alice, noteId } = await setup();
    await t.mutation(internal.assistantData.updateNote, {
      userId: alice,
      noteId,
      body: "- Qi Condensation\n- Foundation Establishment",
    });
    const note = await t.run((ctx) => ctx.db.get("notes", noteId));
    expect(note!.body).toBe("- Qi Condensation\n- Foundation Establishment");
  });

  it("refuses someone else's note, bad ids, and empty changes", async () => {
    const { t, alice, bob, noteId } = await setup();
    expect(
      await t.mutation(internal.assistantData.updateNote, {
        userId: bob,
        noteId,
        title: "Mine now",
      }),
    ).toEqual({
      error: "No note with that id.",
    });
    expect(
      await t.mutation(internal.assistantData.updateNote, {
        userId: alice,
        noteId: "nope",
        title: "x",
      }),
    ).toEqual({
      error: "No note with that id.",
    });
    expect(await t.mutation(internal.assistantData.updateNote, { userId: alice, noteId })).toEqual({
      error: "Nothing to change.",
    });
    const note = await t.run((ctx) => ctx.db.get("notes", noteId));
    expect(note!.title).toBe("Cultivation ranks");
  });
});

describe("updateSeries", () => {
  it("changes status, alternative names and total chapters", async () => {
    const { t, alice, seriesId } = await setup();
    const res = await t.mutation(internal.assistantData.updateSeries, {
      userId: alice,
      seriesId,
      status: "completed",
      altNames: ["BTTH", "btth", "Doupo Cangqiong"],
      totalChapters: 1648,
    });
    expect(res).toMatchObject({ id: seriesId, status: "completed" });
    const series = await t.run((ctx) => ctx.db.get("series", seriesId));
    expect(series).toMatchObject({
      status: "completed",
      altNames: ["BTTH", "Doupo Cangqiong"],
      totalChapters: 1648,
      chapter: 348,
    });
  });

  it("refuses someone else's series and negative totals", async () => {
    const { t, alice, bob, seriesId } = await setup();
    expect(
      await t.mutation(internal.assistantData.updateSeries, {
        userId: bob,
        seriesId,
        status: "dropped",
      }),
    ).toEqual({
      error: "No series with that id.",
    });
    expect(
      await t.mutation(internal.assistantData.updateSeries, {
        userId: alice,
        seriesId,
        totalChapters: -1,
      }),
    ).toEqual({
      error: "Total chapters must be 0 or more.",
    });
    const series = await t.run((ctx) => ctx.db.get("series", seriesId));
    expect(series!.status).toBe("reading");
  });
});
