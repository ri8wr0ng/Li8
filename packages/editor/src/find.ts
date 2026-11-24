import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type FindMatch = { from: number; to: number };

type FindState = {
  query: string;
  activeIndex: number;
  matches: FindMatch[];
  decorations: DecorationSet;
};

export const findPluginKey = new PluginKey<FindState>("noteFind");

/** Case-insensitive matches of `query` in the document's text, block by block. */
export function findMatches(doc: PMNode, query: string): FindMatch[] {
  const needle = query.toLowerCase();
  if (!needle) return [];
  const matches: FindMatch[] = [];
  doc.descendants((block, blockPos) => {
    if (!block.isTextblock) return true;
    // Text of the block, and the document position of each character in it.
    let text = "";
    const positions: number[] = [];
    block.forEach((child, offset) => {
      const start = blockPos + 1 + offset;
      if (child.isText) {
        const value = child.text ?? "";
        for (let i = 0; i < value.length; i++) positions.push(start + i);
        text += value;
      } else {
        positions.push(start);
        text += "\n";
      }
    });
    const haystack = text.toLowerCase();
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      const last = positions[index + needle.length - 1];
      const first = positions[index];
      if (first !== undefined && last !== undefined) matches.push({ from: first, to: last + 1 });
      index = haystack.indexOf(needle, index + needle.length);
    }
    return false;
  });
  return matches;
}

function build(doc: PMNode, query: string, activeIndex: number): FindState {
  const matches = findMatches(doc, query);
  const active = matches.length ? Math.min(Math.max(activeIndex, 0), matches.length - 1) : 0;
  const decorations = DecorationSet.create(
    doc,
    matches.map((match, index) =>
      Decoration.inline(match.from, match.to, {
        class: index === active ? "note-find-match note-find-active" : "note-find-match",
      }),
    ),
  );
  return { query, activeIndex: active, matches, decorations };
}

function isFindMeta(value: unknown): value is { query: string; activeIndex: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    typeof value.query === "string" &&
    "activeIndex" in value &&
    typeof value.activeIndex === "number"
  );
}

export function getFindState(state: EditorState): FindState | undefined {
  return findPluginKey.getState(state);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteFind: {
      /** Highlight `query` everywhere, with match `activeIndex` marked as the current one. */
      setFind: (query: string, activeIndex?: number) => ReturnType;
    };
  }
}

/** Find-in-note highlighting. Style `.note-find-match` and `.note-find-active`. */
export const FindHighlight = Extension.create({
  name: "noteFind",
  addCommands() {
    return {
      setFind:
        (query, activeIndex = 0) =>
        ({ tr, dispatch }) => {
          if (dispatch)
            tr.setMeta(findPluginKey, { query, activeIndex }).setMeta("addToHistory", false);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findPluginKey,
        state: {
          init: (_, state) => build(state.doc, "", 0),
          apply(tr, previous, _, next) {
            const meta: unknown = tr.getMeta(findPluginKey);
            if (isFindMeta(meta)) return build(next.doc, meta.query, meta.activeIndex);
            if (tr.docChanged && previous.query) {
              return build(next.doc, previous.query, previous.activeIndex);
            }
            return previous;
          },
        },
        props: {
          decorations: (state) => findPluginKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

/** Match `index` of the current find, for selecting it when find closes. */
export function getFindMatch(editor: { state: EditorState }, index: number): FindMatch | null {
  return getFindState(editor.state)?.matches[index] ?? null;
}
