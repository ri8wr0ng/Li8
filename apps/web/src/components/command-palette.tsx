import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  BookMarked,
  BookOpen,
  FilePlus2,
  FileText,
  Library,
  Moon,
  Plus,
  Sparkles,
} from "lucide-react";
import { useReadOnly } from "#/lib/offline";
import { useTheme } from "#/lib/theme";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "#/components/ui/dialog";
import { useSheetDrag } from "#/lib/use-sheet-drag";
import { cn } from "#/lib/utils";
import { Highlight, snippet } from "#/lib/highlight";
import { acronym, formatChapter, parseChapterCommand } from "#/lib/series";
import { api } from "@inkmark/backend/convex/_generated/api";
import { markdownToPlainText } from "@inkmark/editor/plain-text";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";

type PaletteContext = { openPalette: () => void };
const Ctx = createContext<PaletteContext>({ openPalette: () => {} });
export const useCommandPalette = () => useContext(Ctx);

/** "sheet" on phones: a panel above the tab bar with the search box at the bottom, by the thumb. */
type Variant = "dialog" | "sheet";
const isDesktop = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>("dialog");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // A keyboard shortcut means a keyboard: always the classic dialog.
        setVariant("dialog");
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({
      openPalette: () => {
        setVariant(isDesktop() ? "dialog" : "sheet");
        setOpen(true);
      },
    }),
    [],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {variant === "sheet" ? (
        <SearchSheet open={open} onOpenChange={setOpen} />
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            showCloseButton={false}
            className="top-[12%] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl"
          >
            <DialogTitle className="sr-only">Search or run a command</DialogTitle>
            <DialogDescription className="sr-only">
              Search notes and series, or type a series name and a chapter number to update it.
            </DialogDescription>
            {open && <Palette close={() => setOpen(false)} />}
          </DialogContent>
        </Dialog>
      )}
    </Ctx.Provider>
  );
}

/**
 * Phone search: the same palette as a sheet that rises from the tab bar, like
 * the Ask AI sheet. The input sits at the bottom where the thumb already is;
 * results fill the space above it. The tab bar stays visible (tapping it closes).
 */
function SearchSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { sheetRef, handleProps } = useSheetDrag({ onDismiss: () => onOpenChange(false) });
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[25] bg-black/25 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:duration-200" />
        <DialogPrimitive.Content
          ref={(el) => void (sheetRef.current = el)}
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-3 max-h-[min(75dvh,calc(100dvh-env(safe-area-inset-top,0px)-10rem))] bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-[35] flex origin-bottom flex-col overflow-hidden rounded-3xl border bg-background/90 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] backdrop-blur-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-bottom-6 data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-[0.97] data-[state=closed]:slide-out-to-bottom-6 data-[state=closed]:duration-150 data-[state=closed]:ease-out",
            "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=open]:slide-in-from-bottom-0 motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[state=closed]:slide-out-to-bottom-0",
            "data-dragged:animate-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search or run a command</DialogPrimitive.Title>
          {/* Drag handle: pull down to dismiss. */}
          <div {...handleProps} className="relative h-5 shrink-0">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-foreground/25 lg:hidden"
            />
          </div>
          {open && <Palette close={() => onOpenChange(false)} variant="sheet" />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

type MeaningResult =
  | { kind: "note"; note: Doc<"notes">; score: number }
  | { kind: "series"; series: Doc<"series">; score: number };
type MeaningState = { status: "idle" | "loading" | "done" | "error"; results: MeaningResult[] };
type MeaningItem = { kind: "note"; doc: Doc<"notes"> } | { kind: "series"; doc: Doc<"series"> };

const MEANING_MIN_CHARS = 3;
const MEANING_DEBOUNCE_MS = 400;
const KEYWORD_DEBOUNCE_MS = 200;
const REINDEX_KEY = "inkmark:reindexed:v1";
/** Users already reindexed this browser session (localStorage covers later sessions). */
const reindexed = new Set<string>();

type KeywordHit =
  | { type: "note"; doc: Doc<"notes">; terms: string[] }
  | { type: "series"; doc: Doc<"series">; terms: string[] };

function findSeries(name: string, series: Doc<"series">[]) {
  const n = norm(name);
  const exact = series.find(
    (s) =>
      norm(s.title) === n ||
      s.altNames.some((a) => norm(a) === n) ||
      acronym(s.title) === n ||
      s.altNames.some((a) => acronym(a) === n),
  );
  return exact ?? series[0] ?? null;
}

function Palette({ close, variant = "dialog" }: { close: () => void; variant?: Variant }) {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const createNote = useMutation(api.notes.create);
  const createSeries = useMutation(api.series.create);
  const setChapter = useMutation(api.series.setChapter);
  const bump = useMutation(api.series.bump);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim();
  const parsedCommand = parseChapterCommand(debouncedQuery);
  const seriesQuery = parsedCommand?.name ?? debouncedQuery;
  const noteResults = useQuery(
    api.notes.search,
    debouncedQuery ? { query: debouncedQuery, limit: 8 } : "skip",
  );
  const seriesResults: Doc<"series">[] | undefined = useQuery(
    api.library.search,
    seriesQuery ? { query: seriesQuery, limit: 8 } : "skip",
  );
  const terms = useMemo(() => debouncedQuery.split(/\s+/).filter(Boolean), [debouncedQuery]);
  const hits = useMemo<KeywordHit[]>(() => {
    if (q !== debouncedQuery) return [];
    return [
      ...(noteResults ?? []).map((doc) => ({ type: "note" as const, doc, terms })),
      ...(seriesResults ?? []).map((doc) => ({ type: "series" as const, doc, terms })),
    ].slice(0, 8);
  }, [q, debouncedQuery, noteResults, seriesResults, terms]);

  const { isAuthenticated } = useConvexAuth();
  const readOnly = useReadOnly();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const aiStatus = useQuery(api.chat.status, isAuthenticated ? {} : "skip");
  const aiEnabled = aiStatus?.enabled === true;
  const searchByMeaning = useAction(api.embeddings.search);
  const reindexMine = useMutation(api.embeddings.reindexMine);

  // Backfill embeddings for existing notes/series once per browser per user.
  const userId = me?.id;
  useEffect(() => {
    if (!aiEnabled || !userId || readOnly) return;
    const key = `${REINDEX_KEY}:${userId}`;
    if (reindexed.has(userId)) return;
    try {
      if (localStorage.getItem(key)) {
        reindexed.add(userId);
        return;
      }
    } catch {}
    reindexed.add(userId);
    reindexMine({})
      .then(() => {
        try {
          localStorage.setItem(key, "1");
        } catch {}
      })
      .catch(() => {});
  }, [aiEnabled, userId, readOnly, reindexMine]);

  const [meaning, setMeaning] = useState<MeaningState>({ status: "idle", results: [] });
  const meaningSeq = useRef(0);
  useEffect(() => {
    if (!aiEnabled || q.length < MEANING_MIN_CHARS) {
      meaningSeq.current++;
      // Clearing results as the query drops below the minimum; this effect owns the debounced request.
      // oxlint-disable-next-line react/set-state-in-effect
      setMeaning({ status: "idle", results: [] });
      return undefined;
    }
    const seq = ++meaningSeq.current;
    const timer = setTimeout(() => {
      setMeaning((m) => ({ ...m, status: "loading" }));
      searchByMeaning({ query: q })
        .then((results) => {
          if (meaningSeq.current === seq) setMeaning({ status: "done", results });
        })
        .catch(() => {
          if (meaningSeq.current === seq) setMeaning({ status: "error", results: [] });
        });
    }, MEANING_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, aiEnabled, searchByMeaning]);

  // Semantic results carry their owned documents, including non-keyword matches.
  const meaningItems = useMemo<MeaningItem[]>(() => {
    if (meaning.results.length === 0) return [];
    const shown = new Set(hits.map((h) => `${h.type}:${h.doc._id}`));
    const out: MeaningItem[] = [];
    const seen = new Set<string>();
    for (const r of meaning.results) {
      const key = `${r.kind}:${r.kind === "note" ? r.note._id : r.series._id}`;
      if (shown.has(key) || seen.has(key)) continue;
      seen.add(key);
      if (r.kind === "note") {
        out.push({ kind: "note", doc: r.note });
      } else {
        out.push({ kind: "series", doc: r.series });
      }
      if (out.length >= 6) break;
    }
    return out;
  }, [meaning.results, hits]);

  const command = useMemo(() => {
    if (!parsedCommand || !seriesResults) return null;
    return { ...parsedCommand, target: findSeries(parsedCommand.name, seriesResults) };
  }, [parsedCommand, seriesResults]);

  const run = useCallback(
    (fn: () => Promise<unknown>) => {
      close();
      if (readOnly) {
        toast("You're offline. Showing your saved copy, so changes are paused.");
        return;
      }
      fn().catch((err: unknown) => {
        console.error(err);
        toast.error("That didn't work. Please try again.");
      });
    },
    [close, readOnly],
  );

  const newNote = (title?: string) =>
    run(async () => {
      const id = await createNote({ title });
      await navigate({ to: "/notes/$noteId", params: { noteId: id } });
    });

  const addSeries = (title: string, chapter?: number) =>
    run(async () => {
      const id = await createSeries({ title, chapter });
      toast.success(`Added ${title}`, {
        description: chapter ? `Chapter ${formatChapter(chapter)}` : undefined,
        action: {
          label: "Open",
          onClick: () => navigate({ to: "/library/$seriesId", params: { seriesId: id } }),
        },
      });
    });

  const applyCommand = (target: Doc<"series">, chapter?: number, delta?: number) =>
    run(async () => {
      const previous = target.chapter;
      const next = delta !== undefined ? await bump({ id: target._id, delta }) : chapter!;
      if (delta === undefined) await setChapter({ id: target._id, chapter: next });
      toast.success(`${target.title} → Ch. ${formatChapter(next)}`, {
        action: {
          label: "Undo",
          onClick: () => void setChapter({ id: target._id, chapter: previous }),
        },
      });
    });

  return (
    // In the sheet the input renders last visually (flex-col-reverse) but stays first in the DOM, so focus order is unchanged.
    <Command
      shouldFilter={false}
      loop
      className={cn("flex", variant === "sheet" ? "min-h-0 flex-1 flex-col-reverse" : "flex-col")}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4",
          variant === "sheet"
            ? "m-2 mt-0 shrink-0 rounded-2xl border bg-card shadow-sm"
            : "border-b",
        )}
      >
        <Sparkles className="size-4 shrink-0 text-hanko" />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search, or type “btth 349”…"
          enterKeyHint="search"
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>

      <Command.List
        className={cn(
          "overflow-y-auto overscroll-contain p-2",
          variant === "sheet"
            ? "min-h-0 flex-1 [&>[cmdk-list-sizer]]:flex [&>[cmdk-list-sizer]]:min-h-full [&>[cmdk-list-sizer]]:flex-col [&>[cmdk-list-sizer]]:justify-end"
            : "max-h-[min(60dvh,28rem)]",
        )}
      >
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing found.
        </Command.Empty>

        {command?.target && (
          <Group heading="Update chapter">
            <Item
              value="command-set"
              onSelect={() => applyCommand(command.target, command.chapter, command.delta)}
              icon={<BookMarked className="text-hanko" />}
            >
              <span className="truncate">
                {command.delta !== undefined ? (
                  <>
                    {command.delta > 0 ? "+" : ""}
                    {command.delta} on <b className="font-semibold">{command.target.title}</b>
                  </>
                ) : (
                  <>
                    Set <b className="font-semibold">{command.target.title}</b> to Ch.{" "}
                    {formatChapter(command.chapter)}
                  </>
                )}
              </span>
              <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                now {formatChapter(command.target.chapter)}
              </span>
            </Item>
          </Group>
        )}

        {hits.length > 0 && (
          <Group heading="Results">
            {hits.map((hit) =>
              hit.type === "series" ? (
                <Item
                  key={hit.doc._id}
                  value={hit.doc._id}
                  icon={<BookOpen />}
                  onSelect={() => {
                    close();
                    void navigate({ to: "/library/$seriesId", params: { seriesId: hit.doc._id } });
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <Highlight text={hit.doc.title} terms={hit.terms} />
                    </span>
                    {hit.doc.altNames.length > 0 && (
                      <span className="block truncate text-xs text-muted-foreground">
                        <Highlight text={hit.doc.altNames.join(" · ")} terms={hit.terms} />
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    Ch. {formatChapter(hit.doc.chapter)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add one chapter to ${hit.doc.title}`}
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-hanko text-hanko-foreground active:scale-95"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      void bump({ id: hit.doc._id, delta: 1 }).then((n) =>
                        toast.success(`${hit.doc.title} → Ch. ${formatChapter(n)}`),
                      );
                    }}
                  >
                    <Plus className="size-4" />
                  </button>
                </Item>
              ) : (
                <Item
                  key={hit.doc._id}
                  value={hit.doc._id}
                  icon={<FileText />}
                  onSelect={() => {
                    close();
                    void navigate({
                      to: "/notes/$noteId",
                      params: { noteId: hit.doc._id },
                      search: { q },
                    });
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <Highlight text={hit.doc.title || "Untitled"} terms={hit.terms} />
                    </span>
                    {hit.doc.body && (
                      <span className="block truncate text-xs text-muted-foreground">
                        <Highlight
                          text={snippet(markdownToPlainText(hit.doc.body), hit.terms, 40)}
                          terms={hit.terms}
                        />
                      </span>
                    )}
                  </span>
                </Item>
              ),
            )}
          </Group>
        )}

        {(meaning.status === "loading" ||
          meaning.status === "error" ||
          meaningItems.length > 0) && (
          <Group heading="Related by meaning">
            {meaning.status === "loading" && meaningItems.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-muted-foreground">Searching by meaning…</div>
            )}
            {meaning.status === "error" && (
              <div className="px-2.5 py-2 text-xs text-muted-foreground">
                Meaning search is unavailable right now.
              </div>
            )}
            {meaningItems.map((item) =>
              item.kind === "series" ? (
                <Item
                  key={`meaning-series-${item.doc._id}`}
                  value={`meaning-series-${item.doc._id}`}
                  icon={<BookOpen />}
                  onSelect={() => {
                    close();
                    void navigate({ to: "/library/$seriesId", params: { seriesId: item.doc._id } });
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.doc.title}</span>
                    {item.doc.altNames.length > 0 && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.doc.altNames.join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    Ch. {formatChapter(item.doc.chapter)}
                  </span>
                </Item>
              ) : (
                <Item
                  key={`meaning-note-${item.doc._id}`}
                  value={`meaning-note-${item.doc._id}`}
                  icon={<FileText />}
                  onSelect={() => {
                    close();
                    void navigate({
                      to: "/notes/$noteId",
                      params: { noteId: item.doc._id },
                      search: { q },
                    });
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.doc.title || "Untitled"}
                    </span>
                    {item.doc.body && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {snippet(markdownToPlainText(item.doc.body), [], 40)}
                      </span>
                    )}
                  </span>
                </Item>
              ),
            )}
          </Group>
        )}

        {q ? (
          <Group heading="Create">
            {command && !command.target && (
              <Item
                value="create-series-cmd"
                icon={<Library />}
                onSelect={() => addSeries(command.name, command.chapter)}
              >
                Add <b className="font-semibold">“{command.name}”</b> to Library
                {command.chapter !== undefined && <> at Ch. {formatChapter(command.chapter)}</>}
              </Item>
            )}
            <Item value="create-note" icon={<FilePlus2 />} onSelect={() => newNote(q)}>
              New note <b className="truncate font-semibold">“{q}”</b>
            </Item>
            {!command && (
              <Item value="create-series" icon={<Library />} onSelect={() => addSeries(q)}>
                Add <b className="truncate font-semibold">“{q}”</b> to Library
              </Item>
            )}
          </Group>
        ) : (
          <Group heading="Go">
            <Item value="new-note" icon={<FilePlus2 />} onSelect={() => newNote()}>
              New note
            </Item>
            <Item
              value="go-notes"
              icon={<FileText />}
              onSelect={() => (close(), void navigate({ to: "/" }))}
            >
              Notes
            </Item>
            <Item
              value="go-library"
              icon={<Library />}
              onSelect={() => (close(), void navigate({ to: "/library" }))}
            >
              Library
            </Item>
            <Item
              value="theme"
              icon={<Moon />}
              onSelect={() => (close(), setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            >
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </Item>
          </Group>
        )}
      </Command.List>

      <div className="hidden items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground sm:flex">
        <span>
          <Key>↵</Key> select
        </span>
        <span>
          <Key>↑</Key>
          <Key>↓</Key> move
        </span>
        <span className="ml-auto">
          Tip: <span className="font-mono">name 349</span> or{" "}
          <span className="font-mono">name +1</span>
        </span>
      </div>
    </Command>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="mr-1 inline-grid min-w-5 place-items-center rounded border bg-card px-1 font-mono text-[0.7rem]">
      {children}
    </kbd>
  );
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[0.7rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  icon,
  onSelect,
  children,
}: {
  value: string;
  icon: ReactNode;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex min-h-11 cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-sm select-none data-[selected=true]:bg-accent [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground"
    >
      {icon}
      {children}
    </Command.Item>
  );
}
