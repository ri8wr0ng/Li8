import { afterEach, describe, expect, it } from "vitest";

const realIntl = globalThis.Intl;

describe("relativeTime without Intl.RelativeTimeFormat (Hermes on Android)", () => {
  afterEach(() => {
    // No module reset needed: bun test --isolate gives every file a fresh module registry, and
    // this file imports ./time once.
    globalThis.Intl = realIntl;
  });

  it("loads and formats instead of throwing", async () => {
    // Intl's members are not enumerable, so name the ones Hermes does have.
    // Assigned directly: bun's vitest shim has no vi.stubGlobal.
    Reflect.set(globalThis, "Intl", {
      DateTimeFormat: Intl.DateTimeFormat,
      NumberFormat: Intl.NumberFormat,
    });
    const { relativeTime } = await import("./time");
    const now = Date.UTC(2026, 10, 18, 12);
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(relativeTime(now - 60 * 60_000, now)).toBe("1 hour ago");
    expect(relativeTime(now - 24 * 60 * 60_000, now)).toBe("yesterday");
    expect(relativeTime(now + 3 * 24 * 60 * 60_000, now)).toBe("in 3 days");
    expect(relativeTime(now - 10_000, now)).toBe("just now");
  });
});
