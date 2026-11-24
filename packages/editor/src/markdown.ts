import { MarkdownManager } from "@tiptap/markdown";
import type { JSONContent } from "@tiptap/core";
import { noteExtensions } from "./extensions";

let manager: MarkdownManager | null = null;

/** A Markdown parser/serializer with the note schema, for code that has no editor (tests, previews). */
export function noteMarkdown(): MarkdownManager {
  manager ??= new MarkdownManager({
    extensions: noteExtensions(),
    markedOptions: { gfm: true, breaks: true },
  });
  return manager;
}

export function markdownToJson(markdown: string): JSONContent {
  return noteMarkdown().parse(markdown);
}

export function jsonToMarkdown(doc: JSONContent): string {
  return noteMarkdown().serialize(doc);
}
