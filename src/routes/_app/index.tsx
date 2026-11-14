import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { NotebookPen, PenLine, Pin, SearchX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNewNote } from "#/components/app-shell";
import { EmptyState, PageHeader, SearchField, SectionLabel } from "#/components/page";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Highlight, snippet } from "#/lib/highlight";
import { useCachedQuery } from "#/lib/offline";
import { useSearch } from "#/lib/search";
import { relativeTime } from "#/lib/time";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_app/")({
  validateSearch: (search: Record<string, unknown>): { new?: "note" } =>
    search.new === "note" ? { new: "note" } : {},
  component: NotesPage,
});

function NotesPage() {
  const notes = useCachedQuery(api.notes.list, "notes");
  const { search } = useSearch(notes, undefined);
  const [query, setQuery] = useState("");
  const newNote = useNewNote();
  useHomeScreenShortcut(newNote);

  const q = query.trim();
  const hits = useMemo(
    () =>
      search(q, "note").flatMap((h) =>
        h.type === "note" ? [{ note: h.doc, terms: h.terms }] : [],
      ),
    [search, q],
  );
  const pinned = notes?.filter((n) => n.pinned) ?? [];
  const rest = notes?.filter((n) => !n.pinned) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        title="Notes"
        meta={notes ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}` : " "}
        actions={
          <Button variant="hanko" className="rounded-xl lg:hidden" onClick={newNote}>
            <PenLine /> New
          </Button>
        }
      />

      <SearchField className="mt-6" value={query} onChange={setQuery} placeholder="Search notes…" />

      <div className="mt-6">
        {notes === undefined ? (
          <ListSkeleton />
        ) : q ? (
          hits.length ? (
            <>
              <SectionLabel>
                {hits.length} {hits.length === 1 ? "match" : "matches"}
              </SectionLabel>
              <NoteList items={hits} query={q} />
            </>
          ) : (
            <EmptyState icon={<SearchX />} title="No matching notes">
              Nothing matches “{q}”. Try fewer words, or press ⌘K to search your library too.
            </EmptyState>
          )
        ) : notes.length === 0 ? (
          <EmptyState icon={<NotebookPen />} title="Your first note is one click away">
            Notes save as you type. Press <b>⌘K</b> anywhere to search, or type something like{" "}
            <span className="font-mono">Battle Through The Heavens 348</span> to start tracking a
            series.
            <div className="mt-5">
              <Button variant="hanko" className="rounded-xl" onClick={newNote}>
                <PenLine /> Write a note
              </Button>
            </div>
          </EmptyState>
        ) : (
          <div className="space-y-8">
            {pinned.length > 0 && (
              <section>
                <SectionLabel>Pinned</SectionLabel>
                <NoteList items={pinned.map((note) => ({ note, terms: [] }))} />
              </section>
            )}
            {rest.length > 0 && (
              <section>
                {pinned.length > 0 && <SectionLabel>Everything else</SectionLabel>}
                <NoteList items={rest.map((note) => ({ note, terms: [] }))} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The installed app's "New note" shortcut opens /?new=note. */
function useHomeScreenShortcut(newNote: () => Promise<void>) {
  const { new: wantsNew } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const done = useRef(false);
  useEffect(() => {
    // Wait for the live session: the list may be showing the saved copy.
    if (wantsNew !== "note" || done.current || !isAuthenticated) return;
    done.current = true;
    void navigate({ to: "/", search: {}, replace: true }).then(newNote);
  }, [wantsNew, navigate, newNote, isAuthenticated]);
}

function NoteList({
  items,
  query,
}: {
  items: { note: Doc<"notes">; terms: string[] }[];
  query?: string;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {items.map(({ note, terms }) => (
        <li key={note._id}>
          <Link
            to="/notes/$noteId"
            params={{ noteId: note._id }}
            search={query ? { q: query } : {}}
            className="block px-4 py-3.5 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none sm:px-5"
          >
            <div className="flex items-baseline gap-3">
              <h3 className="min-w-0 flex-1 truncate font-medium">
                {note.pinned && (
                  <Pin className="mr-1.5 inline size-3.5 -translate-y-px text-hanko" />
                )}
                {note.title ? (
                  <Highlight text={note.title} terms={terms} />
                ) : (
                  <span className="text-muted-foreground">Untitled</span>
                )}
              </h3>
              <time className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(note.updatedAt)}
              </time>
            </div>
            {note.body.trim() && (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                <Highlight text={snippet(note.body, terms, 90)} terms={terms} />
              </p>
            )}
            {note.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.7rem] font-medium text-secondary-foreground"
                  >
                    #<Highlight text={tag} terms={terms} />
                  </span>
                ))}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-2xl border bg-card">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 px-5 py-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
