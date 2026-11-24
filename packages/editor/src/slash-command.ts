import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { Suggestion } from "@tiptap/suggestion";
import { runEditorCommand, type EditorCommand } from "./commands";

/** One entry in the "/" menu. Plain data; each app picks its own icons by `id`. */
export type SlashItem = {
  id: string;
  title: string;
  /** Extra words that match while filtering, besides the title. */
  keywords: string[];
  command: EditorCommand;
};

export const SLASH_ITEMS: SlashItem[] = [
  { id: "text", title: "Text", keywords: ["paragraph", "plain"], command: { type: "paragraph" } },
  {
    id: "heading1",
    title: "Heading 1",
    keywords: ["h1", "title"],
    command: { type: "heading", level: 1 },
  },
  {
    id: "heading2",
    title: "Heading 2",
    keywords: ["h2", "subtitle"],
    command: { type: "heading", level: 2 },
  },
  { id: "heading3", title: "Heading 3", keywords: ["h3"], command: { type: "heading", level: 3 } },
  {
    id: "bulletList",
    title: "Bulleted list",
    keywords: ["ul", "unordered", "bullets"],
    command: { type: "bulletList" },
  },
  {
    id: "orderedList",
    title: "Numbered list",
    keywords: ["ol", "ordered", "numbers"],
    command: { type: "orderedList" },
  },
  {
    id: "taskList",
    title: "Task list",
    keywords: ["todo", "checkbox", "checklist"],
    command: { type: "taskList" },
  },
  {
    id: "blockquote",
    title: "Quote",
    keywords: ["blockquote", "cite"],
    command: { type: "blockquote" },
  },
  {
    id: "codeBlock",
    title: "Code block",
    keywords: ["code", "pre", "snippet"],
    command: { type: "codeBlock" },
  },
  {
    id: "horizontalRule",
    title: "Divider",
    keywords: ["hr", "rule", "line", "separator"],
    command: { type: "horizontalRule" },
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) || item.keywords.some((word) => word.startsWith(q)),
  );
}

export type SlashMenuState =
  | { open: false }
  | {
      open: true;
      items: SlashItem[];
      index: number;
      /** Where the typed "/…" sits on screen, for placing the menu. Read it again on scroll. */
      clientRect: (() => DOMRect | null) | null;
    };

/**
 * Per-editor menu state. The extension owns the keyboard handling; the app only draws
 * `state` and calls `select` on a click.
 */
export type SlashCommandStorage = {
  state: SlashMenuState;
  subscribe: (listener: () => void) => () => void;
  select: (index: number) => void;
  hover: (index: number) => void;
  /** Internal: who to tell when `state` changes, and what picking an item does right now. */
  listeners: Set<() => void>;
  run: ((item: SlashItem) => void) | null;
};

declare module "@tiptap/core" {
  interface Storage {
    slashCommand: SlashCommandStorage;
  }
}

const CLOSED: SlashMenuState = { open: false };

function setState(storage: SlashCommandStorage, state: SlashMenuState) {
  storage.state = state;
  for (const listener of storage.listeners) listener();
}

/** Typing "/" at the start of a word opens a menu of blocks to insert. */
export const SlashCommand = Extension.create<Record<string, never>, SlashCommandStorage>({
  name: "slashCommand",

  addStorage() {
    const storage: SlashCommandStorage = {
      state: CLOSED,
      listeners: new Set(),
      run: null,
      subscribe: (listener) => {
        storage.listeners.add(listener);
        return () => storage.listeners.delete(listener);
      },
      // Bound in addProseMirrorPlugins.
      select: () => {},
      hover: () => {},
    };
    return storage;
  },

  addProseMirrorPlugins() {
    // Tiptap gives the editor a copy of what addStorage returned, so the methods that read
    // `state` and `run` are bound here, to the object the editor and the app actually see.
    const storage = this.storage;
    const set = (state: SlashMenuState) => setState(storage, state);
    storage.select = (index) => {
      const { state } = storage;
      const item = state.open ? state.items[index] : undefined;
      if (item && storage.run) storage.run(item);
    };
    storage.hover = (index) => {
      const { state } = storage;
      if (state.open && index !== state.index) set({ ...state, index });
    };
    const run = (fn: (item: SlashItem) => void) => {
      storage.run = fn;
    };

    return [
      // oxlint-disable-next-line new-cap -- Suggestion is a plugin factory, not a class
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey("slashCommand"),
        char: "/",
        startOfLine: false,
        allowSpaces: false,
        // Not inside code, where "/" is just a character.
        allow: ({ editor }) => !editor.isActive("codeBlock") && !editor.isActive("code"),
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          editor.chain().focus().deleteRange(range).run();
          runEditorCommand(editor, props.command);
        },
        render: () => ({
          onStart: (props) => {
            run(props.command);
            set(
              props.items.length
                ? { open: true, items: props.items, index: 0, clientRect: props.clientRect ?? null }
                : CLOSED,
            );
          },
          onUpdate: (props) => {
            run(props.command);
            set(
              props.items.length
                ? {
                    open: true,
                    items: props.items,
                    index: 0,
                    clientRect: props.clientRect ?? null,
                  }
                : CLOSED,
            );
          },
          onKeyDown: ({ event }) => {
            const { state } = storage;
            if (!state.open) return false;
            const count = state.items.length;
            switch (event.key) {
              case "ArrowDown":
                set({ ...state, index: (state.index + 1) % count });
                return true;
              case "ArrowUp":
                set({ ...state, index: (state.index - 1 + count) % count });
                return true;
              case "Enter":
              case "Tab":
                storage.select(state.index);
                return true;
              case "Escape":
                set(CLOSED);
                return true;
              default:
                return false;
            }
          },
          onExit: () => {
            storage.run = null;
            set(CLOSED);
          },
        }),
      }),
    ];
  },
});
