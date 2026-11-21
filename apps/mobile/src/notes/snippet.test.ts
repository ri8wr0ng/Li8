import { afterEach, describe, expect, it } from "vitest";
import { snippet, termsRegex } from "./snippet";

describe("snippet helpers on Hermes (no Array.prototype.toSorted)", () => {
  const original = Object.getOwnPropertyDescriptor(Array.prototype, "toSorted");

  afterEach(() => {
    // Put back the real method the test removed.
    // oxlint-disable-next-line no-extend-native
    if (original) Object.defineProperty(Array.prototype, "toSorted", original);
  });

  it("builds the terms regex without toSorted, longest term first", () => {
    // @ts-expect-error simulate Hermes, which lacks it
    delete Array.prototype.toSorted;
    const regex = termsRegex(["ab", "abc", " ", "ab"]);
    expect(regex?.source).toBe("(abc|ab)");
    expect(snippet("one two abc three", ["abc"], 4)).toBe("…two abc thr…");
  });
});
