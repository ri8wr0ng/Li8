import { runEditorCommand, type EditorCommand, type NoteEditorController } from "@inkmark/editor";
import { BubbleMenu } from "@inkmark/editor/menus";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Code,
  Italic,
  Link2,
  Strikethrough,
  Trash2,
  Underline,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "#/lib/utils";

const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

/** The viewport below any sticky chrome (`data-sticky-chrome`) that covers the top of the page. */
function visibleArea() {
  let top = 0;
  for (const el of document.querySelectorAll<HTMLElement>("[data-sticky-chrome]")) {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.top < window.innerHeight / 2) top = Math.max(top, rect.bottom);
  }
  return {
    x: 0,
    y: top,
    width: window.innerWidth,
    height: Math.max(0, window.innerHeight - top),
  };
}

/**
 * Formatting for the selected text, floating just above it. Shows for a text selection outside
 * code blocks; the link button swaps the buttons for an address field in place.
 */
export function NoteBubbleMenu({ controller }: { controller: NoteEditorController }) {
  const { editor, toolbar } = controller;
  const [linking, setLinking] = useState(false);
  const linkingRef = useRef(false);
  // shouldShow is read by the menu plugin outside React, so it reads the latest value from a ref.
  useLayoutEffect(() => {
    linkingRef.current = linking;
  }, [linking]);

  if (!editor) return null;
  const run = (command: EditorCommand) => runEditorCommand(editor, command);
  const closeLink = () => {
    setLinking(false);
    editor.commands.focus();
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 8,
        // Treat the sticky header and toolbars as off-screen, so a selection on the first lines
        // flips the menu below the text instead of sliding it under (or over) the toolbar.
        flip: () => ({ rootBoundary: visibleArea(), padding: 8 }),
        shift: () => ({ rootBoundary: visibleArea(), padding: 8 }),
      }}
      shouldShow={({ editor: instance, view, from, to }) => {
        if (linkingRef.current) return true;
        if (!instance.isEditable || from === to || !view.hasFocus()) return false;
        if (instance.isActive("codeBlock") || instance.isActive("horizontalRule")) return false;
        return instance.state.doc.textBetween(from, to).trim().length > 0;
      }}
      className="not-typeset z-40"
    >
      <div
        role="toolbar"
        aria-label="Format selection"
        className="flex items-center gap-0.5 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        {linking ? (
          <LinkForm
            initial={toolbar.link ?? ""}
            canRemove={Boolean(toolbar.link)}
            onApply={(href) => {
              run({ type: "link", href });
              setLinking(false);
            }}
            onCancel={closeLink}
          />
        ) : (
          <>
            <BubbleButton
              icon={Bold}
              label={`Bold (${MOD} B)`}
              active={toolbar.bold}
              onClick={() => run({ type: "bold" })}
            />
            <BubbleButton
              icon={Italic}
              label={`Italic (${MOD} I)`}
              active={toolbar.italic}
              onClick={() => run({ type: "italic" })}
            />
            <BubbleButton
              icon={Underline}
              label={`Underline (${MOD} U)`}
              active={toolbar.underline}
              onClick={() => run({ type: "underline" })}
            />
            <BubbleButton
              icon={Strikethrough}
              label={`Strikethrough (${MOD} Shift S)`}
              active={toolbar.strike}
              onClick={() => run({ type: "strike" })}
            />
            <BubbleButton
              icon={Code}
              label={`Inline code (${MOD} E)`}
              active={toolbar.code}
              onClick={() => run({ type: "code" })}
            />
            <BubbleButton
              icon={Link2}
              label="Link"
              active={Boolean(toolbar.link)}
              onClick={() => setLinking(true)}
            />
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <BubbleButton
              icon={AlignLeft}
              label="Align left"
              active={toolbar.align === "left"}
              onClick={() => run({ type: "align", value: "left" })}
            />
            <BubbleButton
              icon={AlignCenter}
              label="Center"
              active={toolbar.align === "center"}
              onClick={() => run({ type: "align", value: "center" })}
            />
            <BubbleButton
              icon={AlignRight}
              label="Align right"
              active={toolbar.align === "right"}
              onClick={() => run({ type: "align", value: "right" })}
            />
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

function BubbleButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // Keep the selection: a mousedown would otherwise blur the editor and hide the menu.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon />
    </button>
  );
}

function LinkForm({
  initial,
  canRemove,
  onApply,
  onCancel,
}: {
  initial: string;
  canRemove: boolean;
  onApply: (href: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex items-center gap-0.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onApply(value);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Paste or type a link"
        aria-label="Link address"
        inputMode="url"
        className="h-8 w-56 min-w-0 rounded-lg bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      {canRemove && <BubbleButton icon={Trash2} label="Remove link" onClick={() => onApply("")} />}
      <BubbleButton
        icon={Check}
        label="Apply link"
        onClick={() => value.trim() && onApply(value)}
      />
    </form>
  );
}
