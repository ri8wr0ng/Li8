import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "#/lib/utils";

/** Shared by the textarea and its highlight layer so their text lines up exactly. */
const TYPO =
  "m-0 block w-full border-0 p-0 font-sans text-[1.0625rem] leading-[1.75] tracking-normal whitespace-pre-wrap [overflow-wrap:anywhere]";

export type HighlightTextareaHandle = {
  focus: () => void;
  selectRange: (start: number, end: number) => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Start offsets of matches in `value`. */
  matches: number[];
  matchLength: number;
  activeIndex: number;
  /** Change this to scroll the active match into view. */
  scrollKey: number;
  className?: string;
};

/**
 * An auto-growing textarea with search hits painted behind the text. A
 * transparent-text copy of the content sits under the textarea, with <mark>s
 * where the matches are, so highlights work while you keep typing.
 */
export const HighlightTextarea = forwardRef<HighlightTextareaHandle, Props>(
  function HighlightTextarea(
    { value, onChange, placeholder, matches, matchLength, activeIndex, scrollKey, className },
    ref,
  ) {
    const textarea = useRef<HTMLTextAreaElement>(null);
    const layer = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textarea.current?.focus(),
      selectRange: (start, end) => {
        const el = textarea.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        el.setSelectionRange(start, end);
      },
    }));

    useLayoutEffect(() => {
      const el = textarea.current;
      if (!el) return undefined;
      const resize = () => {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, [value]);

    useEffect(() => {
      if (scrollKey === 0) return;
      const mark = layer.current?.querySelector<HTMLElement>(`mark[data-index="${activeIndex}"]`);
      mark?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [scrollKey, activeIndex]);

    const pieces: ReactNode[] = [];
    let cursor = 0;
    matches.forEach((start, i) => {
      if (start > cursor) pieces.push(value.slice(cursor, start));
      pieces.push(
        <mark
          key={start}
          data-index={i}
          data-active={i === activeIndex}
          className="text-transparent!"
        >
          {value.slice(start, start + matchLength)}
        </mark>,
      );
      cursor = start + matchLength;
    });
    pieces.push(value.slice(cursor));

    return (
      <div className={cn("relative", className)}>
        <div
          ref={layer}
          aria-hidden
          className={cn(TYPO, "pointer-events-none absolute inset-0 text-transparent select-none")}
        >
          {pieces}
          {/* Keeps a trailing newline from collapsing. */}
          {"​"}
        </div>
        <textarea
          ref={textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={8}
          spellCheck
          className={cn(
            TYPO,
            "relative min-h-[40dvh] resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground/70",
          )}
        />
      </div>
    );
  },
);
