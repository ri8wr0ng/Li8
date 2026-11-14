import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, Library, MessageCircle, Search, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAiPanel } from "#/components/ask/ai-panel";
import { cn } from "#/lib/utils";

type Tab = { to: "/" | "/ask" | "/library"; label: string; icon: ReactNode; match: (path: string) => boolean };

const NOTES: Tab = { to: "/", label: "Notes", icon: <FileText />, match: (p) => p === "/" || p.startsWith("/notes") };
const ASK: Tab = { to: "/ask", label: "Ask", icon: <MessageCircle />, match: (p) => p.startsWith("/ask") };
const LIBRARY: Tab = { to: "/library", label: "Library", icon: <Library />, match: (p) => p.startsWith("/library") };

/**
 * Phone navigation: a floating glass bar whose lit lens slides to the current
 * tab, with search as its own round glass button beside it.
 *
 * Motion: the lens glides on an iOS-style curve with no overshoot (a tap
 * carries no momentum, so nothing should bounce), and stretches briefly toward
 * where it's heading so the move reads as one liquid motion. Reduced motion
 * turns both off; the highlight simply appears on the new tab.
 */
export function MobileNav({ showAsk, onSearch }: { showAsk: boolean; onSearch: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const ai = useAiPanel();
  const tabs = showAsk ? [NOTES, ASK, LIBRARY] : [NOTES, LIBRARY];
  const active = tabs.findIndex((t) => t.match(path));

  // Remember where the lens came from, so it can stretch toward where it's going.
  // (Adjusting state during render on a prop change; React re-renders right away.)
  const [lens, setLens] = useState({ at: active, from: active, moves: 0 });
  if (lens.at !== active) {
    setLens({ at: active, from: lens.at, moves: lens.moves + (active >= 0 && lens.at >= 0 ? 1 : 0) });
  }
  const direction = active > lens.from ? "right" : "left";
  const moves = { current: lens.moves };

  return (
    <>
      {/* Scroll edge: content fades as it slides under the floating bar instead of cutting off at its edge. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(7rem+env(safe-area-inset-bottom,0px))] bg-linear-to-t from-background via-background/75 to-transparent lg:hidden"
      />
      <nav
        aria-label="Main"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pl-[max(1rem,env(safe-area-inset-left))] lg:hidden"
      >
        {/* Centered row: round tabs in a compact glass bar, then search and Ask AI as round glass buttons. */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="glass pointer-events-auto relative flex h-16 items-center gap-1 rounded-full p-1.5">
            {active >= 0 && (
              <span
                aria-hidden
                className="absolute top-1.5 left-1.5 size-13 transition-transform duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
                // One tab is 3.25rem wide, plus the 0.25rem gap between tabs.
                style={{ transform: `translateX(calc(${active} * 3.5rem))` }}
              >
                {/* Keyed so the stretch replays on every move; origin is the side it left from. */}
                <span
                  key={moves.current}
                  data-direction={direction}
                  className={cn(
                    "glass-active block size-full rounded-full",
                    moves.current > 0 && "animate-[lens-stretch_320ms_cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none",
                    "data-[direction=left]:origin-right data-[direction=right]:origin-left",
                  )}
                />
              </span>
            )}
            {tabs.map((tab, i) => (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={i === active ? "page" : undefined}
                className={cn(
                  "relative z-10 flex size-13 flex-col items-center justify-center gap-0.5 rounded-full text-[0.625rem] font-semibold tracking-[0.01em] outline-none select-none [-webkit-touch-callout:none]",
                  "transition-[color,transform] duration-150 ease-out active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-ring",
                  "[&>svg]:size-5 [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:ease-out",
                  i === active
                    ? "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.25)] [&>svg]:scale-105"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
              </Link>
            ))}
          </div>

          <RoundButton label="Search" onClick={onSearch}>
            <Search className="size-6" />
          </RoundButton>

          {ai.available && (
            <RoundButton label="Ask AI" onClick={ai.toggle} pressed={ai.open}>
              <Sparkles className="size-6 text-hanko" />
            </RoundButton>
          )}
        </div>
      </nav>
    </>
  );
}

function RoundButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="glass pointer-events-auto grid size-16 shrink-0 place-items-center rounded-full text-foreground outline-none transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.92] aria-pressed:ring-2 aria-pressed:ring-hanko/60"
    >
      {children}
    </button>
  );
}
