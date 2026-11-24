import { useEditor, useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { EMPTY_TOOLBAR_STATE, getToolbarState, type EditorToolbarState } from "./commands";
import { noteExtensions } from "./extensions";
import { getFindState } from "./find";

export type UseNoteEditorOptions = {
  /** The note body as Markdown. Changes from outside (another device) replace the content. */
  value: string;
  onChange?: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  /** Find-in-note query; empty clears the highlights. */
  find?: string;
  activeIndex?: number;
  autofocus?: boolean;
};

export type NoteEditorController = {
  editor: Editor | null;
  toolbar: EditorToolbarState;
  matchCount: number;
  /** Document position of the current find match, or -1. Changes when the current match moves. */
  activeMatchFrom: number;
};

export function useNoteEditor({
  value,
  onChange,
  editable = true,
  placeholder,
  find = "",
  activeIndex = 0,
  autofocus = false,
}: UseNoteEditorOptions): NoteEditorController {
  // The Markdown the editor holds right now, so an echo of our own save doesn't reset the cursor.
  const current = useRef(value);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });
  const extensions = useMemo(() => noteExtensions({ placeholder }), [placeholder]);

  const editor = useEditor(
    {
      extensions,
      content: value,
      contentType: "markdown",
      editable,
      autofocus: autofocus ? "end" : false,
      // TanStack Start renders on the server; the editor needs the DOM.
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: { attributes: { class: "note-editor", spellcheck: "true" } },
      onUpdate: ({ editor: instance, transaction }) => {
        if (!transaction.docChanged) return;
        const markdown = instance.getMarkdown();
        if (markdown === current.current) return;
        current.current = markdown;
        onChangeRef.current?.(markdown);
      },
    },
    [extensions],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed || value === current.current) return;
    current.current = value;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setFind(find, activeIndex);
  }, [editor, find, activeIndex]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      if (!instance) return null;
      const findState = getFindState(instance.state);
      return {
        toolbar: getToolbarState(instance),
        matchCount: findState?.matches.length ?? 0,
        activeMatchFrom: findState?.matches[findState.activeIndex]?.from ?? -1,
      };
    },
  });

  return {
    editor,
    toolbar: state?.toolbar ?? EMPTY_TOOLBAR_STATE,
    matchCount: state?.matchCount ?? 0,
    activeMatchFrom: state?.activeMatchFrom ?? -1,
  };
}

/** Scrolls the current find match into view; returns its top relative to the editor, if any. */
export function revealActiveMatch(editor: Editor, scroll = true): number | null {
  const find = getFindState(editor.state);
  const match = find?.matches[find.activeIndex];
  if (!match) return null;
  const dom = editor.view.dom.querySelector(".note-find-active");
  if (scroll) dom?.scrollIntoView({ block: "center", behavior: "smooth" });
  const top = editor.view.coordsAtPos(match.from).top;
  return top - editor.view.dom.getBoundingClientRect().top;
}
