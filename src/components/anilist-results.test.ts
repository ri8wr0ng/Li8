import { describe, expect, it, vi } from "vitest";
import { handleListKey } from "./anilist-results";

describe("AniList keyboard selection", () => {
  function press(key: string, count: number, active: number) {
    const event = { key, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const setActive = vi.fn();
    const pick = vi.fn();
    handleListKey(event, count, active, setActive, pick);
    return { event, setActive, pick };
  }

  it("clears a stale selection without picking or submitting after results shrink", () => {
    const { event, setActive, pick } = press("Enter", 2, 7);
    expect(pick).not.toHaveBeenCalled();
    expect(setActive).toHaveBeenCalledWith(-1);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("moves a stale selection back into the current results", () => {
    expect(press("ArrowUp", 2, 7).setActive).toHaveBeenCalledWith(1);
  });

  it("picks a valid selection", () => {
    expect(press("Enter", 2, 1).pick).toHaveBeenCalledWith(1);
  });
});
