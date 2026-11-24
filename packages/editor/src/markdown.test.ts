import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

beforeAll(() => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    DOMParser: window.DOMParser,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    navigator: window.navigator,
  });
});

async function roundTrip(markdown: string) {
  const { jsonToMarkdown, markdownToJson } = await import("./markdown");
  return jsonToMarkdown(markdownToJson(markdown));
}

describe("note markdown round trip", () => {
  const cases: Record<string, string> = {
    headings: "# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six",
    marks: "**bold** *italic* <u>under</u> ~~strike~~ `code`",
    link: "See [the docs](https://example.com) now",
    bullets: "- one\n- two\n  - nested",
    ordered: "1. one\n2. two",
    tasks: "- [ ] todo\n- [x] done",
    quote: "> quoted",
    codeBlock: "```ts\nconst a = 1;\n```",
    centered: '<p align="center">Hello <strong>you</strong></p>',
    alignedHeading: '<h2 align="right">Title</h2>',
    lineBreaks: "milk\neggs\nbread",
    plainParagraphs: "first paragraph\n\nsecond paragraph",
  };
  test.each(Object.entries(cases))("%s", async (_name, markdown) => {
    expect(await roundTrip(markdown)).toBe(markdown);
  });
});

describe("note markdown structure", () => {
  test("aligned HTML becomes an aligned paragraph with marks, not literal text", async () => {
    const { markdownToJson } = await import("./markdown");
    const doc = markdownToJson('<p align="center">Hello <strong>you</strong></p>');
    const paragraph = doc.content?.[0];
    expect(paragraph?.type).toBe("paragraph");
    expect(paragraph?.attrs?.textAlign).toBe("center");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("bold");
  });

  test("task items keep their checked state", async () => {
    const { markdownToJson } = await import("./markdown");
    const doc = markdownToJson("- [ ] todo\n- [x] done");
    expect(doc.content?.[0]?.type).toBe("taskList");
    expect(doc.content?.[0]?.content?.map((item) => item.attrs?.checked)).toEqual([false, true]);
  });

  test("single newlines are line breaks", async () => {
    const { markdownToJson } = await import("./markdown");
    const doc = markdownToJson("milk\neggs");
    expect(doc.content?.[0]?.content?.some((node) => node.type === "hardBreak")).toBe(true);
  });
});
