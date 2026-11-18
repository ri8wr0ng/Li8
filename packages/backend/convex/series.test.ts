/// <reference types="vite/client" />
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { convexTest } from "convex-test";
import { expect, test, vi } from "vite-plus/test";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("label deletion cleans references across multiple batches", async () => {
  vi.useFakeTimers();
  try {
    const { t, reader, id, userId } = await setup();
    const labelId = await reader.mutation(api.labels.create, { name: "Temporary" });
    await t.run(async (ctx) => {
      const original = await ctx.db.get("series", id);
      if (!original) throw new Error("Missing series");
      const { _id, _creationTime, ...fields } = original;
      for (let i = 0; i < 205; i++) {
        await ctx.db.insert("series", { ...fields, title: `Show ${i}`, labelIds: [labelId] });
      }
    });
    await reader.mutation(api.labels.remove, { id: labelId });
    expect(await reader.query(api.labels.list, {})).toEqual([]);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const remaining = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("series")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .collect();
      return rows.filter((row) => row.labelIds?.includes(labelId));
    });
    expect(remaining).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

async function setup(chapter = 348) {
  const t = convexTest(schema, modules);
  registerCore(t);
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
    userId,
    claims: { method: "google", profile: {} },
    componentPath: "authGoogle",
    accessTokenTtlSeconds: 60,
    refreshInactivityTimeoutSeconds: 3600,
    sessionMaxLifetimeSeconds: 3600,
  });
  const reader = t.withIdentity(sessionIdentity(tokens));
  const id = await reader.mutation(api.series.create, {
    title: "Battle Through The Heavens",
    chapter,
  });
  return { t, reader, id, userId };
}

test("repeated bumps preserve every increment and clamp decrements at zero", async () => {
  const { reader, id } = await setup();
  await Promise.all([
    reader.mutation(api.series.bump, { id, delta: 1 }),
    reader.mutation(api.series.bump, { id, delta: 1 }),
  ]);
  expect((await reader.query(api.series.get, { id }))?.chapter).toBe(350);
  await reader.mutation(api.series.bump, { id, delta: -1000 });
  expect((await reader.query(api.series.get, { id }))?.chapter).toBe(0);
});

test.each([NaN, Infinity, -Infinity])(
  "rejects non-finite delta %s without changing progress",
  async (delta) => {
    const { reader, id } = await setup();
    await expect(reader.mutation(api.series.bump, { id, delta })).rejects.toThrow();
    expect((await reader.query(api.series.get, { id }))?.chapter).toBe(348);
    expect((await reader.query(api.series.history, { seriesId: id }))[0].chapter).toBe(348);
  },
);

test("rejects overflow without changing progress", async () => {
  const { reader, id } = await setup(Number.MAX_VALUE);
  await expect(reader.mutation(api.series.bump, { id, delta: Number.MAX_VALUE })).rejects.toThrow();
  expect((await reader.query(api.series.get, { id }))?.chapter).toBe(Number.MAX_VALUE);
});

test("unauthenticated callers cannot read or change personal progress", async () => {
  const { t, id } = await setup();
  expect(await t.query(api.series.get, { id })).toBeNull();
  expect(await t.query(api.series.history, { seriesId: id })).toEqual([]);
  await expect(t.mutation(api.series.bump, { id, delta: 1 })).rejects.toThrow("Not signed in");
});

test("nextSeason increments season, resets chapter to 0, and records history", async () => {
  const { reader, id } = await setup(12);
  // Default season starts undefined or 1
  const res = await reader.mutation(api.series.nextSeason, { id });
  expect(res).toEqual({ season: 2, chapter: 0 });

  const updated = await reader.query(api.series.get, { id });
  expect(updated?.season).toBe(2);
  expect(updated?.chapter).toBe(0);

  const hist = await reader.query(api.series.history, { seriesId: id });
  expect(hist[0].season).toBe(2);
  expect(hist[0].chapter).toBe(0);

  // Advancing season again
  const res2 = await reader.mutation(api.series.nextSeason, { id });
  expect(res2).toEqual({ season: 3, chapter: 0 });
  const updated2 = await reader.query(api.series.get, { id });
  expect(updated2?.season).toBe(3);
  expect(updated2?.chapter).toBe(0);
});

test("labels lifecycle: create, dedupe, attach to series, rename, remove pulls from series", async () => {
  const { t, reader, id } = await setup(5);

  // Create label
  const labelId1 = await reader.mutation(api.labels.create, { name: "Korean" });
  expect(labelId1).toBeDefined();

  // Dedupe case-insensitively
  const labelId2 = await reader.mutation(api.labels.create, { name: "korean " });
  expect(labelId2).toBe(labelId1);

  // List labels
  const list = await reader.query(api.labels.list, {});
  expect(list.some((l) => l._id === labelId1 && l.name === "Korean")).toBe(true);

  // Attach label to series
  await reader.mutation(api.series.update, {
    id,
    labelIds: [labelId1],
  });
  const seriesWithLabel = await reader.query(api.series.get, { id });
  expect(seriesWithLabel?.labelIds).toEqual([labelId1]);

  // Rename label
  await reader.mutation(api.labels.rename, { id: labelId1, name: "K-Drama" });
  const listAfterRename = await reader.query(api.labels.list, {});
  expect(listAfterRename.find((l) => l._id === labelId1)?.name).toBe("K-Drama");

  // Other user cannot attach this label
  const otherUserId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
  const otherTokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
    userId: otherUserId,
    claims: { method: "google", profile: {} },
    componentPath: "authGoogle",
    accessTokenTtlSeconds: 60,
    refreshInactivityTimeoutSeconds: 3600,
    sessionMaxLifetimeSeconds: 3600,
  });
  const otherUser = t.withIdentity(sessionIdentity(otherTokens));
  await expect(
    otherUser.mutation(api.series.create, {
      title: "Some Anime",
      labelIds: [labelId1],
    }),
  ).rejects.toThrow();

  // Remove label pulls it out of series.labelIds
  await reader.mutation(api.labels.remove, { id: labelId1 });
  const seriesAfterRemove = await reader.query(api.series.get, { id });
  expect(seriesAfterRemove?.labelIds).toEqual([]);
});

test("maintains searchText with title, altNames, acronyms, genres, and kind", async () => {
  const { reader, id } = await setup();
  await reader.mutation(api.series.update, {
    id,
    altNames: ["Doupo Cangqiong"],
    genres: ["Action", "Fantasy"],
    kind: "manhua",
  });
  const series = await reader.query(api.series.get, { id });
  expect(series?.searchText).toContain("Battle Through The Heavens");
  expect(series?.searchText).toContain("Doupo Cangqiong");
  expect(series?.searchText).toContain("btth");
  expect(series?.searchText).toContain("dc");
  expect(series?.searchText).toContain("Action");
  expect(series?.searchText).toContain("Fantasy");
  expect(series?.searchText).toContain("manhua");
});
