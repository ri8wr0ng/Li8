import type { Editor } from "@tiptap/core";
import type { Alignment } from "./extensions";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Every toolbar action, as plain data so the mobile app can send it across the WebView. */
export type EditorCommand =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "paragraph" }
  | { type: "heading"; level: HeadingLevel }
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "code" }
  | { type: "bulletList" }
  | { type: "orderedList" }
  | { type: "taskList" }
  | { type: "blockquote" }
  | { type: "codeBlock" }
  | { type: "align"; value: Alignment }
  /** An empty `href` removes the link. */
  | { type: "link"; href: string };

/** What the toolbar shows as on, off, or unavailable. Plain data for the same reason. */
export type EditorToolbarState = {
  canUndo: boolean;
  canRedo: boolean;
  /** 0 for body text. */
  heading: 0 | HeadingLevel;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  align: Alignment;
  link: string | null;
  hasSelection: boolean;
};

export const EMPTY_TOOLBAR_STATE: EditorToolbarState = {
  canUndo: false,
  canRedo: false,
  heading: 0,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  blockquote: false,
  codeBlock: false,
  align: "left",
  link: null,
  hasSelection: false,
};

export function runEditorCommand(editor: Editor, command: EditorCommand): boolean {
  const chain = editor.chain().focus();
  switch (command.type) {
    case "undo":
      return chain.undo().run();
    case "redo":
      return chain.redo().run();
    case "paragraph":
      return chain.setParagraph().run();
    case "heading":
      return chain.toggleHeading({ level: command.level }).run();
    case "bold":
      return chain.toggleBold().run();
    case "italic":
      return chain.toggleItalic().run();
    case "underline":
      return chain.toggleUnderline().run();
    case "strike":
      return chain.toggleStrike().run();
    case "code":
      return chain.toggleCode().run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "taskList":
      return chain.toggleTaskList().run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "codeBlock":
      return chain.toggleCodeBlock().run();
    case "align":
      return chain.setTextAlign(command.value).run();
    case "link": {
      const href = command.href.trim();
      if (!href) return chain.extendMarkRange("link").unsetLink().run();
      if (editor.state.selection.empty && !editor.isActive("link")) {
        // Nothing selected: insert the address itself as the link text.
        return chain
          .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
          .run();
      }
      return chain.extendMarkRange("link").setLink({ href }).run();
    }
    default:
      return false;
  }
}

function currentAlign(editor: Editor): Alignment {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const value: unknown = $from.node(depth).attrs.textAlign;
    if (value === "center" || value === "right" || value === "justify") return value;
    if ($from.node(depth).isTextblock) break;
  }
  return "left";
}

export function getToolbarState(editor: Editor): EditorToolbarState {
  let heading: EditorToolbarState["heading"] = 0;
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    if (editor.isActive("heading", { level })) heading = level;
  }
  const href: unknown = editor.getAttributes("link").href;
  return {
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    heading,
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    blockquote: editor.isActive("blockquote"),
    codeBlock: editor.isActive("codeBlock"),
    align: currentAlign(editor),
    link: typeof href === "string" ? href : null,
    hasSelection: !editor.state.selection.empty,
  };
}
