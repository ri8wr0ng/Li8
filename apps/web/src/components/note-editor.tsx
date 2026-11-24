import {
  EditorContent,
  runEditorCommand,
  type Alignment,
  type EditorCommand,
  type HeadingLevel,
  useNoteEditor,
  type NoteEditorController,
} from "@inkmark/editor";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";

const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

const HEADING_LABELS: Record<0 | HeadingLevel, string> = {
  0: "Text",
  1: "Heading 1",
  2: "Heading 2",
  3: "Heading 3",
  4: "Heading 4",
  5: "Heading 5",
  6: "Heading 6",
};

const HEADING_SIZES: Record<0 | HeadingLevel, string> = {
  0: "text-sm",
  1: "text-2xl font-semibold",
  2: "text-xl font-semibold",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
  5: "text-sm font-semibold",
  6: "text-xs font-semibold uppercase tracking-wide",
};

const ALIGN_OPTIONS: { value: Alignment; label: string; icon: LucideIcon; keys: string }[] = [
  { value: "left", label: "Align left", icon: AlignLeft, keys: "Shift L" },
  { value: "center", label: "Center", icon: AlignCenter, keys: "Shift E" },
  { value: "right", label: "Align right", icon: AlignRight, keys: "Shift R" },
  { value: "justify", label: "Justify", icon: AlignJustify, keys: "Shift J" },
];

/** The formatting bar above a note. Sticks under the page header while you scroll. */
export function NoteToolbar({
  controller,
  disabled,
  className,
}: {
  controller: NoteEditorController;
  disabled?: boolean;
  className?: string;
}) {
  const { editor, toolbar } = controller;
  const off = disabled || !editor;
  const run = (command: EditorCommand) => {
    if (editor) runEditorCommand(editor, command);
  };
  const [linkOpen, setLinkOpen] = useState(false);

  // Mod-K opens the link box, like most editors.
  useEffect(() => {
    if (!editor || off) return undefined;
    const dom = editor.view.dom;
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        setLinkOpen(true);
      }
    }
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  }, [editor, off]);

  const alignOption = ALIGN_OPTIONS.find((o) => o.value === toolbar.align) ?? ALIGN_OPTIONS[0];
  const AlignIcon = alignOption.icon;

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn(
        "flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <ToolButton
        icon={Undo2}
        label="Undo"
        keys={`${MOD} Z`}
        disabled={off || !toolbar.canUndo}
        onClick={() => run({ type: "undo" })}
      />
      <ToolButton
        icon={Redo2}
        label="Redo"
        keys={`${MOD} Shift Z`}
        disabled={off || !toolbar.canRedo}
        onClick={() => run({ type: "redo" })}
      />

      <Divider />

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={off}
                aria-label="Text style"
                className="w-[7.5rem] shrink-0 justify-between rounded-lg px-2.5 font-normal"
              >
                {HEADING_LABELS[toolbar.heading]}
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Text style</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuRadioGroup
            value={String(toolbar.heading)}
            onValueChange={(value) => {
              const level = Number(value);
              run(
                level === 0
                  ? { type: "paragraph" }
                  : // oxlint-disable-next-line typescript/no-unsafe-type-assertion
                    { type: "heading", level: level as HeadingLevel },
              );
            }}
          >
            {([0, 1, 2, 3, 4, 5, 6] as const).map((level) => (
              <DropdownMenuRadioItem key={level} value={String(level)}>
                <span className={HEADING_SIZES[level]}>{HEADING_LABELS[level]}</span>
                {level > 0 && (
                  <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground">
                    {"#".repeat(level)}
                  </span>
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <ToolButton
        icon={Bold}
        label="Bold"
        keys={`${MOD} B`}
        active={toolbar.bold}
        disabled={off}
        onClick={() => run({ type: "bold" })}
      />
      <ToolButton
        icon={Italic}
        label="Italic"
        keys={`${MOD} I`}
        active={toolbar.italic}
        disabled={off}
        onClick={() => run({ type: "italic" })}
      />
      <ToolButton
        icon={Underline}
        label="Underline"
        keys={`${MOD} U`}
        active={toolbar.underline}
        disabled={off}
        onClick={() => run({ type: "underline" })}
      />
      <ToolButton
        icon={Strikethrough}
        label="Strikethrough"
        keys={`${MOD} Shift S`}
        active={toolbar.strike}
        disabled={off}
        onClick={() => run({ type: "strike" })}
      />
      <ToolButton
        icon={Code}
        label="Inline code"
        keys={`${MOD} E`}
        active={toolbar.code}
        disabled={off}
        onClick={() => run({ type: "code" })}
      />
      <LinkButton
        open={linkOpen}
        onOpenChange={setLinkOpen}
        href={toolbar.link}
        disabled={off}
        onApply={(href) => run({ type: "link", href })}
      />

      <Divider />

      <ToolButton
        icon={List}
        label="Bulleted list"
        keys={`${MOD} Shift 8`}
        active={toolbar.bulletList}
        disabled={off}
        onClick={() => run({ type: "bulletList" })}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        keys={`${MOD} Shift 7`}
        active={toolbar.orderedList}
        disabled={off}
        onClick={() => run({ type: "orderedList" })}
      />
      <ToolButton
        icon={ListChecks}
        label="Task list"
        keys={`${MOD} Shift 9`}
        active={toolbar.taskList}
        disabled={off}
        onClick={() => run({ type: "taskList" })}
      />
      <ToolButton
        icon={Quote}
        label="Quote"
        keys={`${MOD} Shift B`}
        active={toolbar.blockquote}
        disabled={off}
        onClick={() => run({ type: "blockquote" })}
      />
      <ToolButton
        icon={SquareCode}
        label="Code block"
        keys={`${MOD} Alt C`}
        active={toolbar.codeBlock}
        disabled={off}
        onClick={() => run({ type: "codeBlock" })}
      />

      <Divider />

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={off}
                aria-label={`Alignment: ${alignOption.label}`}
                className="shrink-0 gap-1 rounded-lg px-2"
              >
                <AlignIcon />
                <ChevronDown className="size-3.5! text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Alignment</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuRadioGroup
            value={toolbar.align}
            onValueChange={(value) => {
              const option = ALIGN_OPTIONS.find((o) => o.value === value);
              if (option) run({ type: "align", value: option.value });
            }}
          >
            {ALIGN_OPTIONS.map(({ value, label, icon: Icon, keys }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon /> {label}
                <span className="ml-auto text-[0.7rem] text-muted-foreground">
                  {MOD} {keys}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

function ToolButton({
  icon: Icon,
  label,
  keys,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  keys?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          // Keep the editor's selection: a mousedown on the button would otherwise blur it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn("shrink-0 rounded-lg", active && "bg-accent text-accent-foreground")}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {keys && <span className="ml-1.5 opacity-60">{keys}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function LinkButton({
  open,
  onOpenChange,
  href,
  disabled,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  href: string | null;
  disabled?: boolean;
  onApply: (href: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(href ?? "");
        onOpenChange(next);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Link"
              aria-pressed={Boolean(href)}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              className={cn("shrink-0 rounded-lg", href && "bg-accent text-accent-foreground")}
            >
              <Link2 />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Link <span className="ml-1.5 opacity-60">{MOD} K</span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-2">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(value);
            onOpenChange(false);
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste or type a link"
            aria-label="Link address"
            inputMode="url"
            className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {href && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onApply("");
                onOpenChange(false);
              }}
            >
              Remove
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!value.trim()}>
            {href ? "Update" : "Add"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** The editable note body. Styles live under `.note-editor` in styles.css. */
export function NoteEditorContent({
  controller,
  className,
}: {
  controller: NoteEditorController;
  className?: string;
}): ReactNode {
  return (
    <EditorContent
      editor={controller.editor}
      className={cn("prose dark:prose-invert max-w-none", className)}
    />
  );
}

/** A note body, formatted and read-only (the public share page). */
export function NoteViewer({ markdown, className }: { markdown: string; className?: string }) {
  const controller = useNoteEditor({ value: markdown, editable: false });
  return <NoteEditorContent controller={controller} className={className} />;
}
