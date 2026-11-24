import type { Editor, SlashCommandStorage, SlashMenuState } from "@inkmark/editor";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  SquareCode,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "#/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  text: Pilcrow,
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  bulletList: List,
  orderedList: ListOrdered,
  taskList: ListChecks,
  blockquote: Quote,
  codeBlock: SquareCode,
  horizontalRule: Minus,
};

const CLOSED: SlashMenuState = { open: false };
const noop = () => () => {};

/** The "/" menu: draws `editor.storage.slashCommand`, which handles the keys itself. */
export function SlashMenu({ editor }: { editor: Editor }) {
  // Undefined when the editor was made without `slashCommands`.
  const storage: SlashCommandStorage | undefined = editor.storage.slashCommand;
  const state = useSyncExternalStore(
    storage?.subscribe ?? noop,
    () => storage?.state ?? CLOSED,
    () => CLOSED,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Place it under the "/", or above when there's no room, and follow it while the page scrolls.
  useLayoutEffect(() => {
    if (!state.open) return undefined;
    const place = () => {
      const rect = state.clientRect?.();
      const menu = menuRef.current;
      if (!rect || !menu) return;
      const gap = 6;
      const { offsetHeight: height, offsetWidth: width } = menu;
      const below = rect.bottom + gap;
      const top = below + height > window.innerHeight - 8 ? rect.top - gap - height : below;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPosition({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [state]);

  // Keep the highlighted row in view as the arrow keys move it.
  const activeIndex = state.open ? state.index : -1;
  useLayoutEffect(() => {
    menuRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!state.open || !storage) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Insert block"
      style={position ?? { top: 0, left: 0, visibility: "hidden" }}
      className="fixed z-50 max-h-80 w-60 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-100"
    >
      <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">Blocks</p>
      {state.items.map((item, index) => {
        const Icon = ICONS[item.id] ?? Pilcrow;
        const active = index === state.index;
        return (
          // The editor keeps focus and handles the arrow keys and Enter (see SlashCommand), so the
          // rows only need the mouse.
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
          <div
            key={item.id}
            role="option"
            tabIndex={-1}
            aria-selected={active}
            data-index={index}
            // Keep focus (and the typed "/…") in the editor.
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => storage.hover(index)}
            onClick={() => storage.select(index)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-background">
              <Icon className="size-4" />
            </span>
            {item.title}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
