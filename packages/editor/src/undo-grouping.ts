import { Extension } from "@tiptap/core";
import { closeHistory, isHistoryTransaction } from "@tiptap/pm/history";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";

// Adapted from t3code's composer: undo steps through typing, deleting and pasting separately,
// instead of one undo removing a word you typed together with the paste before it.

type ChangeKind = "insert" | "delete" | "other";

function changeKindOf(tr: Transaction): ChangeKind | null {
  if (!tr.docChanged) return null;
  const uiEvent: unknown = tr.getMeta("uiEvent");
  if (uiEvent === "paste" || uiEvent === "drop" || uiEvent === "cut") return "other";
  // IME input replaces its own range on each keystroke; it is still typing.
  if (tr.getMeta("composition") !== undefined) return "insert";
  let kind: ChangeKind | null = null;
  for (const step of tr.steps) {
    if (!(step instanceof ReplaceStep)) return "other";
    const inserts = step.slice.size > 0;
    const deletes = step.to > step.from;
    const stepKind = inserts && !deletes ? "insert" : deletes && !inserts ? "delete" : "other";
    if (kind !== null && kind !== stepKind) return "other";
    kind = stepKind;
  }
  return kind;
}

export const UndoGrouping = Extension.create({
  name: "undoGrouping",
  addProseMirrorPlugins() {
    let previous: ChangeKind | null = null;
    return [
      new Plugin({
        key: new PluginKey("undoGrouping"),
        // Runs before the transaction is applied, which is when history reads closeHistory.
        filterTransaction(tr) {
          if (isHistoryTransaction(tr)) {
            previous = "other";
            return true;
          }
          if (tr.getMeta("addToHistory") === false) return true;
          const kind = changeKindOf(tr);
          if (kind === null) return true;
          if (previous !== null && (kind !== previous || kind === "other")) closeHistory(tr);
          previous = kind;
          return true;
        },
      }),
    ];
  },
});
