import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useMutation } from "convex/react";
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
import { useCachedQuery, useReadOnly } from "#/lib/offline";
import { useTheme } from "#/lib/theme";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "#/components/ui/dialog";
import { Highlight, snippet } from "#/lib/highlight";
import { useSearch } from "#/lib/search";
import { acronym, formatChapter, parseChapterCommand } from "#/lib/series";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

type PaletteContext = { openPalette: () => void };
const Ctx = createContext<PaletteContext>({ openPalette: () => {} });
export const useCommandPalette = () => useContext(Ctx);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ openPalette: () => setOpen(true) }), []);
  return (
    <Ctx.Provider value={value}>
      {children}
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
    </Ctx.Provider>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function findSeries(
  name: string,
  series: Doc<"series">[],
  searchSeries: (q: string) => Doc<"series">[],
) {
  const n = norm(name);
  const exact = series.find(
    (s) => norm(s.title) === n || s.altNames.some((a) => norm(a) === n) || acronym(s.title) === n,
  );
  return exact ?? searchSeries(name)[0] ?? null;
}

function Palette({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const notes = useCachedQuery(api.notes.list, "notes");
  const series = useCachedQuery(api.series.list, "series");
  const createNote = useMutation(api.notes.create);
  const createSeries = useMutation(api.series.create);
  const setChapter = useMutation(api.series.setChapter);
  const bump = useMutation(api.series.bump);
  const { search } = useSearch(notes, series);
  const [query, setQuery] = useState("");

  const q = query.trim();
  const hits = useMemo(() => search(q).slice(0, 8), [search, q]);

  const command = useMemo(() => {
    const parsed = parseChapterCommand(q);
    if (!parsed || !series) return null;
    const target = findSeries(parsed.name, series, (name) =>
      search(name, "series", true).flatMap((h) => (h.type === "series" ? [h.doc] : [])),
    );
    return { ...parsed, target };
  }, [q, series, search]);

  const readOnly = useReadOnly();
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
    <Command shouldFilter={false} loop className="flex flex-col">
      <div className="flex items-center gap-3 border-b px-4">
        <Sparkles className="size-4 shrink-0 text-hanko" />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search, or type “btth 349”…"
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>

      <Command.List className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-2">
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
                        <Highlight text={snippet(hit.doc.body, hit.terms, 40)} terms={hit.terms} />
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
