import { Link, useRouterState } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { ChartColumn, History, Maximize2, MessageCircle, Plus, Sparkles, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Conversation, type CurrentPage } from "#/components/ask/conversation";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useCachedQuery } from "#/lib/offline";
import { useSheetDrag } from "#/lib/use-sheet-drag";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const OPEN_KEY = "inkmark:ai-panel:open";
const THREAD_KEY = "inkmark:ai-panel:thread";

type PanelState = {
  /** AI is set up and allowed for this user. The same on every page, so nothing shifts on navigation. */
  available: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const PanelContext = createContext<PanelState | null>(null);

export function useAiPanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("useAiPanel must be used inside AiPanelProvider");
  return ctx;
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or storage full; the panel still works, it just won't remember.
  }
}

export function AiPanelProvider({ children }: { children: ReactNode }) {
  // Cached so the AI entry points render on first paint instead of popping in after the query.
  const status = useCachedQuery(api.chat.status, "chat-status");
  const available = status?.enabled === true;
  const [open, setOpenState] = useState(false);

  // Reopen on desktop if it was open last time; on phones it covers the page, so start closed.
  // Read after mount (localStorage and the viewport don't exist during prerender).
  useEffect(() => {
    if (readStorage(OPEN_KEY) === "1" && window.matchMedia("(min-width: 1024px)").matches) {
      // oxlint-disable-next-line react/set-state-in-effect
      setOpenState(true);
    }
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    writeStorage(OPEN_KEY, next ? "1" : null);
  }, []);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  // ⌘J / Ctrl+J toggles the panel.
  useEffect(() => {
    if (!available) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [available, toggle]);

  const value = useMemo(
    () => ({ available, open: available && open, setOpen, toggle }),
    [available, open, setOpen, toggle],
  );
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

/** The note or series open in the main view, if any. */
function useCurrentPage(): CurrentPage | null {
  // The deepest match has the page's own params (noteId / seriesId).
  const params = useRouterState({
    select: (s) => (s.matches.at(-1)?.params ?? {}) as { noteId?: string; seriesId?: string },
    structuralSharing: true,
  });
  const { isAuthenticated } = useConvexAuth();
  // Route params are plain strings; the queries validate the id with v.id().
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const noteId = params.noteId as Id<"notes"> | undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const seriesId = params.seriesId as Id<"series"> | undefined;
  const note = useQuery(api.notes.get, isAuthenticated && noteId ? { id: noteId } : "skip");
  const series = useQuery(api.series.get, isAuthenticated && seriesId ? { id: seriesId } : "skip");
  return useMemo(() => {
    if (note) return { kind: "note" as const, id: note._id, title: note.title || "Untitled" };
    if (series) {
      return { kind: "series" as const, id: series._id, title: series.title || "Untitled" };
    }
    return null;
  }, [note, series]);
}

/**
 * Chat with the assistant beside any page. On desktop it's a column next to
 * the content; on phones a floating sheet above the nav.
 */
export function AiPanel() {
  const { open, setOpen } = useAiPanel();
  const page = useCurrentPage();
  const threads = useQuery(api.chat.threads, open ? {} : "skip");
  const [threadId, setThreadIdState] = useState<string | undefined>(
    () => readStorage(THREAD_KEY) ?? undefined,
  );

  const setThreadId = useCallback((id: string | undefined) => {
    setThreadIdState(id);
    writeStorage(THREAD_KEY, id ?? null);
  }, []);

  // A remembered chat that was deleted (e.g. from the Ask page) counts as no chat.
  const activeThreadId =
    threadId && threads && !threads.some((t) => t.id === threadId) ? undefined : threadId;

  // Close with Escape on phones, where the sheet sits over the page.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Phones: drag the sheet's header down to dismiss it.
  const { sheetRef, handleProps } = useSheetDrag({ onDismiss: () => setOpen(false) });

  // On phones the sheet sinks back into the nav it rose from before unmounting.
  // On desktop the column closes at once (the grid drops its track immediately).
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  // Mount/unmount follows an exit animation timeline, so this effect sets state on purpose.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setMounted(false);
      return undefined;
    }
    // Dismissed by dragging: it has already left the screen, so skip the exit animation.
    if (sheetRef.current && "dragged" in sheetRef.current.dataset) {
      setMounted(false);
      return undefined;
    }
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 180);
    return () => clearTimeout(t);
  }, [open, mounted, sheetRef]);
  /* oxlint-enable react/set-state-in-effect */

  if (!mounted) return null;
  const current = threads?.find((t) => t.id === activeThreadId);

  return (
    <>
      {/* Phones: a light dim behind the sheet; tap it to close. The nav stays above it and usable. */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[25] bg-black/25 lg:hidden",
          closing
            ? "animate-out fade-out duration-150 fill-mode-forwards"
            : "animate-in fade-in duration-200",
        )}
      />
      <aside
        ref={(el) => void (sheetRef.current = el)}
        data-ai-panel
        data-state={closing ? "closed" : "open"}
        aria-label="Ask Inkmark"
        className={cn(
          // Phones: a floating sheet between the top bar and the nav, input at its bottom, rising from the nav.
          "fixed inset-x-3 h-[min(75dvh,calc(100dvh-env(safe-area-inset-top,0px)-10rem))] bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-[35] flex origin-bottom flex-col overflow-hidden rounded-3xl border bg-background/90 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] backdrop-blur-2xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-bottom-6 data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(0.32,0.72,0,1)]",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-[0.97] data-[state=closed]:slide-out-to-bottom-6 data-[state=closed]:duration-150 data-[state=closed]:ease-out data-[state=closed]:fill-mode-forwards",
          "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=open]:slide-in-from-bottom-0 motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[state=closed]:slide-out-to-bottom-0",
          // Desktop: a column beside the content.
          "lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:h-dvh lg:w-96 lg:shrink-0 lg:rounded-none lg:border-0 lg:border-l lg:bg-background lg:shadow-none lg:backdrop-blur-none lg:data-[state=open]:zoom-in-100 lg:data-[state=open]:slide-in-from-bottom-0 xl:w-[28rem]",
        )}
      >
        <header
          {...handleProps}
          className="relative flex h-14 shrink-0 items-center gap-1 border-b pr-2 pl-4"
        >
          {/* Grabber: says "this sheet can be dragged down". */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-foreground/25 lg:hidden"
          />
          <Sparkles className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {current?.title ?? "Ask Inkmark"}
          </h2>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Chat history">
                <History />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Recent chats
              </DropdownMenuLabel>
              {threads?.length ? (
                threads.slice(0, 20).map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onSelect={() => setThreadId(t.id)}
                    className={cn(t.id === activeThreadId && "bg-accent")}
                  >
                    <MessageCircle /> <span className="truncate">{t.title}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No chats yet.</p>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/ask">
                  <Maximize2 /> All chats
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/profile" hash="ai-usage">
                  <ChartColumn /> AI usage
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="New chat"
            onClick={() => setThreadId(undefined)}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-8 sm:inline-flex"
            aria-label="Open in full page"
            asChild
          >
            <Link to="/ask" search={activeThreadId ? { threadId: activeThreadId } : {}}>
              <Maximize2 />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </header>

        <Conversation
          key={activeThreadId ?? "new"}
          threadId={activeThreadId}
          onThread={setThreadId}
          page={page}
          compact
        />
      </aside>
    </>
  );
}
