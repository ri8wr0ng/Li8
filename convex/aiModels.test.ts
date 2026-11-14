import { describe, expect, it } from "vite-plus/test";
import { noteText, seriesText, textHash } from "./aiModels";

describe("aiModels pure helpers", () => {
  describe("textHash", () => {
    it("is stable across multiple calls for the same text", () => {
      const text = "Return of the Blossoming Blade chapter 140";
      const hash1 = textHash(text);
      const hash2 = textHash(text);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1).toMatch(/^[0-9a-z]+-\d+$/);
    });

    it("changes when the text changes", () => {
      const base = "Solo Leveling";
      const hashBase = textHash(base);
      const hashModified = textHash("Solo Leveling Ragnarok");
      const hashMinor = textHash("solo leveling");
      const hashExtraSpace = textHash("Solo Leveling ");

      expect(hashModified).not.toBe(hashBase);
      expect(hashMinor).not.toBe(hashBase);
      expect(hashExtraSpace).not.toBe(hashBase);
    });

    it("handles empty text deterministically", () => {
      expect(textHash("")).toBe(textHash(""));
      expect(textHash("")).not.toBe(textHash(" "));
    });
  });

  describe("noteText", () => {
    it("formats title, tags with # prefix, and body separated by double newlines", () => {
      const note = {
        title: "Cultivation Realms",
        tags: ["manhua", "notes", "xianxia"],
        body: "Qi Condensation -> Foundation Establishment -> Core Formation",
      };
      const formatted = noteText(note);
      expect(formatted).toBe(
        "Cultivation Realms\n\n#manhua #notes #xianxia\n\nQi Condensation -> Foundation Establishment -> Core Formation",
      );
    });

    it("filters out empty or whitespace-only sections", () => {
      const noteWithoutTags = {
        title: "Quick Thought",
        tags: [],
        body: "Remember to read chapter 50.",
      };
      expect(noteText(noteWithoutTags)).toBe("Quick Thought\n\nRemember to read chapter 50.");

      const noteWhitespaceTitle = {
        title: "   ",
        tags: ["reading"],
        body: "Just body content",
      };
      expect(noteText(noteWhitespaceTitle)).toBe("#reading\n\nJust body content");

      const noteEmpty = {
        title: "",
        tags: [],
        body: "   ",
      };
      expect(noteText(noteEmpty)).toBe("");
    });

    it("truncates note text at 8000 characters", () => {
      const longBody = "A".repeat(10_000);
      const note = {
        title: "Long Note",
        tags: ["overflow"],
        body: longBody,
      };
      const formatted = noteText(note);
      expect(formatted.length).toBe(8000);
      expect(formatted.startsWith("Long Note\n\n#overflow\n\nAAA")).toBe(true);
    });

    it("does not truncate note text when within 8000 characters", () => {
      const note = {
        title: "Short Note",
        tags: ["short"],
        body: "Within bounds",
      };
      const formatted = noteText(note);
      expect(formatted).toBe("Short Note\n\n#short\n\nWithin bounds");
      expect(formatted.length).toBeLessThan(8000);
    });
  });

  describe("seriesText", () => {
    it("formats title, alternative names, kind and genres, and description", () => {
      const series = {
        title: "Tower of God",
        altNames: ["TOG", "Sin-ui Tap"],
        kind: "manhwa" as const,
        genres: ["Action", "Fantasy", "Mystery"],
        description: "What do you desire? Money and wealth? Honor and pride?",
      };
      const formatted = seriesText(series);
      expect(formatted).toBe(
        "Tower of God\nAlso known as: TOG, Sin-ui Tap\nmanhwa, Action, Fantasy, Mystery\nWhat do you desire? Money and wealth? Honor and pride?",
      );
    });

    it("omits the alternative names line when altNames is empty", () => {
      const series = {
        title: "Omniscient Reader's Viewpoint",
        altNames: [],
        kind: "manhwa" as const,
        genres: ["Action", "Apocalypse"],
        description: "Only I know the end of this world.",
      };
      const formatted = seriesText(series);
      expect(formatted).toBe(
        "Omniscient Reader's Viewpoint\nmanhwa, Action, Apocalypse\nOnly I know the end of this world.",
      );
    });

    it("handles empty genres and whitespace description", () => {
      const series = {
        title: "Simple Series",
        altNames: [],
        kind: "manga" as const,
        genres: [],
        description: "   ",
      };
      const formatted = seriesText(series);
      expect(formatted).toBe("Simple Series\nmanga");
    });

    it("truncates series text at 8000 characters", () => {
      const longDescription = "B".repeat(10_000);
      const series = {
        title: "Very Long Series",
        altNames: ["VLS"],
        kind: "novel" as const,
        genres: ["Epic"],
        description: longDescription,
      };
      const formatted = seriesText(series);
      expect(formatted.length).toBe(8000);
      expect(formatted.startsWith("Very Long Series\nAlso known as: VLS\nnovel, Epic\nBBBB")).toBe(
        true,
      );
    });

    it("does not truncate series text when within 8000 characters", () => {
      const series = {
        title: "Short Series",
        altNames: ["SS"],
        kind: "manhua" as const,
        genres: ["Martial Arts"],
        description: "A short story.",
      };
      const formatted = seriesText(series);
      expect(formatted.length).toBeLessThan(8000);
      expect(formatted).toBe(
        "Short Series\nAlso known as: SS\nmanhua, Martial Arts\nA short story.",
      );
    });
  });
});
