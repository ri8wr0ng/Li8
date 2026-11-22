/// <reference types="vite/client" />
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function signIn(t: ReturnType<typeof convexTest>, name: string, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { name, email }));
  const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
    userId,
    claims: { method: "google", profile: {} },
    componentPath: "authGoogle",
    accessTokenTtlSeconds: 60,
    refreshInactivityTimeoutSeconds: 3600,
    sessionMaxLifetimeSeconds: 3600,
  });
  return { userId, as: t.withIdentity(sessionIdentity(tokens)) };
}

async function setup() {
  const t = convexTest(schema, modules);
  registerCore(t);
  const owner = await signIn(t, "Owner", "owner@example.com");
  const friend = await signIn(t, "Friend", "friend@example.com");
  const stranger = await signIn(t, "Stranger", "stranger@example.com");
  const id = await owner.as.mutation(api.notes.create, { title: "Plan", body: "secret body" });
  return { t, owner, friend, stranger, id };
}

const page = { paginationOpts: { numItems: 50, cursor: null } };

test("strangers can't read, edit or duplicate a note", async () => {
  const { stranger, id } = await setup();
  expect(await stranger.as.query(api.notes.get, { id })).toBeNull();
  expect(await stranger.as.query(api.notes.access, { id })).toBeNull();
  await expect(stranger.as.mutation(api.notes.update, { id, body: "x" })).rejects.toThrow();
  await expect(stranger.as.mutation(api.notes.duplicate, { id })).rejects.toThrow();
  await expect(
    stranger.as.mutation(api.notes.share, { id, email: "stranger@example.com", role: "edit" }),
  ).rejects.toThrow();
  expect(await stranger.as.query(api.notes.shares, { id })).toBeNull();
});

test("viewers can read and copy but not change a note", async () => {
  const { owner, friend, id } = await setup();
  await owner.as.mutation(api.notes.share, { id, email: "FRIEND@example.com", role: "view" });
  expect((await friend.as.query(api.notes.get, { id }))?.body).toBe("secret body");
  expect((await friend.as.query(api.notes.access, { id }))?.role).toBe("view");
  await expect(friend.as.mutation(api.notes.update, { id, body: "x" })).rejects.toThrow();
  const copy = await friend.as.mutation(api.notes.duplicate, { id });
  const copied = await friend.as.query(api.notes.get, { id: copy });
  expect(copied?.title).toBe("Plan (copy)");
  expect(copied?.userId).toBe(friend.userId);
  const shared = await friend.as.query(api.notes.sharedWithMe, {});
  expect(shared.map((s) => s.note._id)).toEqual([id]);
});

test("editors can change text but not pin, archive, share or delete", async () => {
  const { owner, friend, id } = await setup();
  await owner.as.mutation(api.notes.share, { id, email: "friend@example.com", role: "edit" });
  await friend.as.mutation(api.notes.update, { id, body: "edited" });
  expect((await owner.as.query(api.notes.get, { id }))?.body).toBe("edited");
  await expect(friend.as.mutation(api.notes.update, { id, pinned: true })).rejects.toThrow();
  await expect(friend.as.mutation(api.notes.setArchived, { id, archived: true })).rejects.toThrow();
  await expect(friend.as.mutation(api.notes.setPublic, { id, enabled: true })).rejects.toThrow();
  await expect(friend.as.mutation(api.notes.remove, { id })).rejects.toThrow();
});

test("removing a share takes access away, and people can leave a share", async () => {
  const { owner, friend, id } = await setup();
  await owner.as.mutation(api.notes.share, { id, email: "friend@example.com", role: "edit" });
  await friend.as.mutation(api.notes.unshare, { id, userId: friend.userId });
  expect(await friend.as.query(api.notes.get, { id })).toBeNull();
  await owner.as.mutation(api.notes.share, { id, email: "friend@example.com", role: "view" });
  await owner.as.mutation(api.notes.unshare, { id, userId: friend.userId });
  expect(await friend.as.query(api.notes.sharedWithMe, {})).toEqual([]);
});

test("sharing with an unknown email fails", async () => {
  const { owner, id } = await setup();
  await expect(
    owner.as.mutation(api.notes.share, { id, email: "nobody@example.com", role: "view" }),
  ).rejects.toThrow(/No li8 account/);
});

test("public link shows the note without sign-in and stops working when turned off", async () => {
  const { t, owner, friend, id } = await setup();
  const publicId = await owner.as.mutation(api.notes.setPublic, { id, enabled: true });
  if (!publicId) throw new Error("No public id");
  expect((await t.query(api.notes.getPublic, { publicId }))?.body).toBe("secret body");
  // People it's shared with don't get the owner's link token.
  await owner.as.mutation(api.notes.share, { id, email: "friend@example.com", role: "view" });
  expect((await friend.as.query(api.notes.get, { id }))?.publicId).toBeUndefined();
  await owner.as.mutation(api.notes.setPublic, { id, enabled: false });
  expect(await t.query(api.notes.getPublic, { publicId })).toBeNull();
});

test("archived notes leave the main list and show in the archive", async () => {
  const { owner, id } = await setup();
  await owner.as.mutation(api.notes.setArchived, { id, archived: true });
  const active = await owner.as.query(api.notes.listPage, { ...page, pinned: false });
  expect(active.page).toEqual([]);
  const archived = await owner.as.query(api.notes.listPage, { ...page, archived: true });
  expect(archived.page.map((n) => n._id)).toEqual([id]);
  await owner.as.mutation(api.notes.setArchived, { id, archived: false });
  const back = await owner.as.query(api.notes.listPage, { ...page, pinned: false });
  expect(back.page.map((n) => n._id)).toEqual([id]);
});

test("deleting a note removes its shares", async () => {
  const { t, owner, id } = await setup();
  await owner.as.mutation(api.notes.share, { id, email: "friend@example.com", role: "view" });
  await owner.as.mutation(api.notes.remove, { id });
  const left = await t.run((ctx) => ctx.db.query("noteShares").collect());
  expect(left).toEqual([]);
});
