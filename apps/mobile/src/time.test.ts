import { afterEach, describe, expect, it, vi } from "vite-plus/test";

describe("relativeTime without Intl.RelativeTimeFormat (Hermes on Android)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads and formats instead of throwing", async () => {
    // Intl's members are not enumerable, so name the ones Hermes does have.
    vi.stubGlobal("Intl", { DateTimeFormat: Intl.DateTimeFormat, NumberFormat: Intl.NumberFormat });
    const { relativeTime } = await import("./time");
    const now = Date.UTC(2026, 10, 18, 12);
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(relativeTime(now - 60 * 60_000, now)).toBe("1 hour ago");
    expect(relativeTime(now - 24 * 60 * 60_000, now)).toBe("yesterday");
    expect(relativeTime(now + 3 * 24 * 60 * 60_000, now)).toBe("in 3 days");
    expect(relativeTime(now - 10_000, now)).toBe("just now");
  });
});
