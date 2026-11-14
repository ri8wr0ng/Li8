/// <reference types="vite/client" />
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { reportedCost } from "./usage";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  registerCore(t);
  rateLimiterTest.register(t);
  const alice = await t.run((ctx) => ctx.db.insert("users", { name: "Alice" }));
  const bob = await t.run((ctx) => ctx.db.insert("users", { name: "Bob" }));
  const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
    userId: alice,
    claims: { method: "google", profile: {} },
    componentPath: "authGoogle",
    accessTokenTtlSeconds: 60,
    refreshInactivityTimeoutSeconds: 3600,
    sessionMaxLifetimeSeconds: 3600,
  });
  const asAlice = t.withIdentity(sessionIdentity(tokens));
  const record = (userId: Id<"users">, kind: "chat" | "index" | "search", cost: number, inputTokens = 100) =>
    t.mutation(internal.usage.record, {
      userId,
      kind,
      model: kind === "chat" ? "anthropic/claude-haiku-5.5" : "openai/text-embedding-3-small",
      inputTokens,
      outputTokens: kind === "chat" ? 20 : 0,
      cost,
      estimated: kind !== "chat",
    });
  return { t, alice, bob, asAlice, record };
}

describe("usage.summary", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("totals only the signed-in user's calls, by day, kind and model", async () => {
    const { alice, bob, asAlice, record } = await setup();
    await record(alice, "chat", 0.002);
    await record(alice, "chat", 0.003);
    await record(alice, "search", 0.000002, 10);
    await record(bob, "chat", 5);
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    await record(alice, "index", 0.0001, 5000);

    const s = (await asAlice.query(api.usage.summary, { days: 7, tzOffsetMinutes: 0 }))!;
    expect(s.total.calls).toBe(4);
    expect(s.total.cost).toBeCloseTo(0.005102, 9);
    expect(s.total.inputTokens).toBe(5210);
    expect(s.today).toMatchObject({ calls: 1, inputTokens: 5000 });
    expect(s.byKind.chat).toMatchObject({ calls: 2, outputTokens: 40 });
    expect(s.byModel["openai/text-embedding-3-small"]!.calls).toBe(2);
    expect(s.estimated).toBe(true);

    expect(s.daily).toHaveLength(7);
    expect(s.daily[s.daily.length - 1]!.calls).toBe(1); // Nov 16 (today)
    expect(s.daily[s.daily.length - 3]!.calls).toBe(3); // Nov 14
    expect(new Date(s.daily[s.daily.length - 1]!.day).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });

  it("leaves out calls older than the range", async () => {
    const { alice, asAlice, record } = await setup();
    await record(alice, "chat", 1);
    vi.setSystemTime(new Date("2026-11-30T12:00:00Z"));
    const s = (await asAlice.query(api.usage.summary, { days: 7, tzOffsetMinutes: 0 }))!;
    expect(s.total.calls).toBe(0);
  });

  it("buckets days in the client's time zone", async () => {
    const { alice, asAlice, record } = await setup();
    // 12:00 UTC on Nov 14 is 01:00 on Nov 15 in UTC+13.
    await record(alice, "chat", 1);
    const s = (await asAlice.query(api.usage.summary, { days: 2, tzOffsetMinutes: -13 * 60 }))!;
    expect(s.today.calls).toBe(1);
    expect(s.daily[s.daily.length - 1]!.calls).toBe(1);
  });

  it("reports full limits for a user who hasn't used AI", async () => {
    const { asAlice } = await setup();
    const s = (await asAlice.query(api.usage.summary, { days: 7, tzOffsetMinutes: 0 }))!;
    expect(s.limits.map((l) => [l.name, l.value, l.capacity])).toEqual([
      ["chat", 15, 15],
      ["search", 30, 30],
    ]);
  });

  it("returns null when signed out", async () => {
    const { t } = await setup();
    expect(await t.query(api.usage.summary, { days: 7, tzOffsetMinutes: 0 })).toBeNull();
  });
});

describe("reportedCost", () => {
  it("reads OpenRouter's reported cost", () => {
    expect(reportedCost({ openrouter: { usage: { cost: 0.0012 } } })).toBe(0.0012);
  });
  it("ignores missing or invalid costs", () => {
    expect(reportedCost(undefined)).toBeUndefined();
    expect(reportedCost({ openrouter: { usage: {} } })).toBeUndefined();
    expect(reportedCost({ openrouter: { usage: { cost: "1" } } })).toBeUndefined();
    expect(reportedCost({ openrouter: { usage: { cost: Number.NaN } } })).toBeUndefined();
  });
});
