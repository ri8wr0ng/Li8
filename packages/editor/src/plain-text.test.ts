import { describe, expect, test } from "bun:test";
import { markdownToPlainText } from "./plain-text";

describe("markdownToPlainText", () => {
  test("removes heading markers at every level", () => {
    expect(markdownToPlainText("# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six")).toBe(
      "One\nTwo\nThree\nFour\nFive\nSix",
    );
  });

  test("removes list and task markers while keeping item text", () => {
    expect(markdownToPlainText("- dash\n* star\n+ plus\n1. numbered\n- [ ] todo\n- [x] done")).toBe(
      "dash\nstar\nplus\nnumbered\ntodo\ndone",
    );
  });

  test("removes nested blockquote markers", () => {
    expect(markdownToPlainText("> quote\n> > nested")).toBe("quote\nnested");
  });

  test("drops fence lines and retains fenced code", () => {
    expect(markdownToPlainText("```ts\nconst x = **1**;\n```\n~~~js\ncode\n~~~")).toBe(
      "const x = **1**;\ncode",
    );
  });

  test("removes inline emphasis, strike, and code delimiters", () => {
    expect(
      markdownToPlainText("**bold** __also bold__ *italic* _also italic_ ~~gone~~ `code`"),
    ).toBe("bold also bold italic also italic gone code");
  });

  test("keeps underscores inside words", () => {
    expect(markdownToPlainText("snake_case_words")).toBe("snake_case_words");
  });

  test("converts links and images to their labels", () => {
    expect(markdownToPlainText("[label](https://example.com) ![alt](image.png)")).toBe("label alt");
  });

  test("removes HTML tags and decodes the supported entities", () => {
    expect(
      markdownToPlainText(
        '<u>under</u> <p align="center">para</p> <strong>bold</strong> <h2 align="right">head</h2> <a href="url">link</a><br>&nbsp;&amp;&lt;&gt;&quot;&#39;',
      ),
    ).toBe("under para bold head link &<>\"'");
  });

  test("drops horizontal rules", () => {
    expect(markdownToPlainText("before\n---\n***\n___\nafter")).toBe("before\nafter");
  });

  test("keeps block line breaks, collapses three newlines, and trims", () => {
    expect(markdownToPlainText("  First\n\n\nSecond  ")).toBe("First\n\nSecond");
  });

  test("leaves a plain text note intact apart from trimming", () => {
    expect(markdownToPlainText("  A plain text note.\nWith a second line.  ")).toBe(
      "A plain text note.\nWith a second line.",
    );
  });
});
