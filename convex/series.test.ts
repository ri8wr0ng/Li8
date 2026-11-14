/// <reference types="vite/client" />
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { convexTest } from "convex-test";
import { expect, test } from "vite-plus/test";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
  return { t, reader, id };
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
