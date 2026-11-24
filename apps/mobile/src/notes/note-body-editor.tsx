"use dom";

import {
  EditorContent,
  getFindMatch,
  getFindState,
  runEditorCommand,
  useNoteEditor,
  type EditorCommand,
  type EditorToolbarState,
} from "@inkmark/editor";
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from "expo/dom";
import { forwardRef, useEffect, useRef, type Ref } from "react";
import type { NoteBodyColors } from "./note-body-types";

/** JSON values, as the bridge allows (expo/dom doesn't export the type). */
type BridgeArgs = Parameters<DOMImperativeFactory[string]>;

export interface NoteBodyEditorHandle extends DOMImperativeFactory {
  /** Takes an `EditorCommand`. */
  run: (...args: BridgeArgs) => void;
  focus: (...args: BridgeArgs) => void;
  selectActiveMatch: (...args: BridgeArgs) => void;
}

type Props = {
  value: string;
  editable: boolean;
  placeholder: string;
  find: string;
  activeIndex: number;
  colors: NoteBodyColors;
  onChange: (markdown: string) => void;
  onToolbarState: (state: EditorToolbarState) => void;
  /** Number of matches, and the top of the current one in px from the top of the editor. */
  onFind: (count: number, activeTop: number) => void;
  /** Bottom of the caret in px from the top of the editor, so the app can keep it on screen. */
  onCaret: (bottom: number) => void;
  onFocusChange: (focused: boolean) => void;
  dom?: DOMProps;
};

/**
 * The note body on mobile: the web app's Tiptap editor, running in a WebView as an Expo DOM
 * component (works in Expo Go). The formatting toolbar is native and drives it through `run`.
 */
export default forwardRef(function NoteBodyEditor(
  {
    value,
    editable,
    placeholder,
    find,
    activeIndex,
    colors,
    onChange,
    onToolbarState,
    onFind,
    onCaret,
    onFocusChange,
  }: Props,
  ref: Ref<NoteBodyEditorHandle>,
) {
  const { editor, toolbar, matchCount, activeMatchFrom } = useNoteEditor({
    value,
    onChange,
    editable,
    placeholder,
    find,
    activeIndex,
  });

  useDOMImperativeHandle(
    ref,
    () => ({
      run: (command) => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        if (editor) runEditorCommand(editor, command as unknown as EditorCommand);
      },
      focus: () => {
        editor?.commands.focus("end");
      },
      selectActiveMatch: () => {
        if (!editor) return;
        const index = getFindState(editor.state)?.activeIndex ?? 0;
        const match = getFindMatch(editor, index);
        if (match) editor.chain().focus().setTextSelection(match).run();
      },
    }),
    [editor],
  );

  // Toolbar state crosses the bridge as JSON; send it only when it changes.
  const lastToolbar = useRef("");
  useEffect(() => {
    const json = JSON.stringify(toolbar);
    if (json === lastToolbar.current) return;
    lastToolbar.current = json;
    onToolbarState(toolbar);
  }, [toolbar, onToolbarState]);

  useEffect(() => {
    if (!editor) return;
    const top =
      activeMatchFrom >= 0
        ? offsetTop(editor.view.coordsAtPos(activeMatchFrom).top, editor.view.dom)
        : 0;
    onFind(matchCount, top);
  }, [editor, matchCount, activeMatchFrom, onFind]);

  useEffect(() => {
    if (!editor) return undefined;
    const sendCaret = () => {
      if (!editor.isFocused) return;
      const coords = editor.view.coordsAtPos(editor.state.selection.head);
      onCaret(offsetTop(coords.bottom, editor.view.dom));
    };
    const focus = () => {
      onFocusChange(true);
      sendCaret();
    };
    const blur = () => onFocusChange(false);
    editor.on("selectionUpdate", sendCaret);
    editor.on("focus", focus);
    editor.on("blur", blur);
    return () => {
      editor.off("selectionUpdate", sendCaret);
      editor.off("focus", focus);
      editor.off("blur", blur);
    };
  }, [editor, onCaret, onFocusChange]);

  return (
    <>
      <style>{css(colors)}</style>
      <EditorContent editor={editor} className="note-editor-root" />
    </>
  );
});

function offsetTop(viewportY: number, root: HTMLElement) {
  return Math.round(viewportY - root.getBoundingClientRect().top);
}

function css(c: NoteBodyColors) {
  return `
    html, body { margin: 0; padding: 0; background: transparent; width: 100%; }
    /* Expo's DOM root can shrink to its content, which would make text-align centre in a narrow box. */
    body > *, .note-editor-root, .note-editor { width: 100%; box-sizing: border-box; }
    body {
      color: ${c.ink};
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
      -webkit-text-size-adjust: 100%;
      -webkit-tap-highlight-color: transparent;
      overflow-wrap: anywhere;
    }
    .note-editor { outline: none; min-height: 240px; padding: 12px 0 24px; caret-color: ${c.hanko}; }
    .note-editor > :first-child { margin-top: 0; }
    .note-editor p { margin: 0 0 0.75em; }
    .note-editor h1, .note-editor h2, .note-editor h3,
    .note-editor h4, .note-editor h5, .note-editor h6 {
      margin: 1.1em 0 0.4em; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em;
    }
    .note-editor h1 { font-size: 1.75em; }
    .note-editor h2 { font-size: 1.45em; }
    .note-editor h3 { font-size: 1.25em; }
    .note-editor h4 { font-size: 1.1em; }
    .note-editor h5 { font-size: 1em; }
    .note-editor h6 { font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.04em; color: ${c.muted}; }
    .note-editor [align="center"] { text-align: center; }
    .note-editor [align="right"] { text-align: right; }
    .note-editor [align="justify"] { text-align: justify; }
    .note-editor ul, .note-editor ol { margin: 0 0 0.75em; padding-left: 1.4em; }
    .note-editor li > p { margin: 0.15em 0; }
    .note-editor blockquote {
      margin: 0 0 0.75em; padding: 0.1em 0 0.1em 0.9em;
      border-left: 3px solid ${c.border}; color: ${c.muted};
    }
    .note-editor code {
      font-family: ui-monospace, Menlo, monospace; font-size: 0.875em;
      background: ${c.card}; border: 1px solid ${c.border}; border-radius: 4px; padding: 0.1em 0.3em;
    }
    .note-editor pre {
      background: ${c.card}; border: 1px solid ${c.border}; border-radius: 8px;
      padding: 0.75em 0.9em; margin: 0 0 0.75em; white-space: pre-wrap;
    }
    .note-editor pre code { background: none; border: 0; padding: 0; font-size: 0.85em; }
    .note-editor a { color: ${c.hanko}; text-underline-offset: 0.2em; }
    .note-editor hr { border: 0; border-top: 1px solid ${c.border}; margin: 1.25em 0; }
    .note-editor ul[data-type="taskList"] { list-style: none; padding-left: 0.1em; }
    .note-editor ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.55em; }
    .note-editor ul[data-type="taskList"] li > label { flex: none; margin-top: 0.2em; }
    .note-editor ul[data-type="taskList"] li > label input {
      width: 18px; height: 18px; margin: 0; accent-color: ${c.hanko};
    }
    .note-editor ul[data-type="taskList"] li > div { flex: 1; min-width: 0; }
    .note-editor ul[data-type="taskList"] li[data-checked="true"] > div {
      color: ${c.muted}; text-decoration: line-through;
    }
    .note-editor p.is-editor-empty:first-child::before {
      content: attr(data-placeholder); float: left; height: 0; pointer-events: none; color: ${c.muted};
    }
    .note-find-match { background: ${c.marker}; border-radius: 3px; }
    .note-find-active { background: ${c.markerActive}; color: #1c1a17; }
  `;
}
