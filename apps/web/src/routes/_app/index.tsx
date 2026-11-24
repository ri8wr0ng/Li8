import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { Archive, NotebookPen, PenLine, Pin, SearchX, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNewNote } from "#/components/app-shell";
import { EmptyState, PageHeader, SearchField, SectionLabel } from "#/components/page";
import { PullToRefresh } from "#/components/pull-to-refresh";
import { NoteRowMenu } from "#/components/note-context-menu";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Highlight, snippet } from "#/lib/highlight";
import { useCachedList, useCachedPaginatedQuery, writeCachedList } from "#/lib/offline";
import { pageTitle } from "#/lib/seo";
import { relativeTime } from "#/lib/time";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import { markdownToPlainText } from "@inkmark/editor/plain-text";

export const Route = createFileRoute("/_app/")({
  validateSearch: (search: Record<string, unknown>): { new?: "note" } =>
    search.new === "note" ? { new: "note" } : {},
  head: () => ({ meta: [{ title: pageTitle("Notes") }] }),
  component: NotesPage,
});

type NotesView = "all" | "shared" | "archived";

function NotesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<NotesView>("all");
  const [paginationKey, setPaginationKey] = useState(0);
  const newNote = useNewNote();
  useHomeScreenShortcut(newNote);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const searchResults = useQuery(
    api.notes.search,
    debouncedQuery ? { query: debouncedQuery } : "skip",
  );

  // The whole page pulls, not just the list, so a pull from the header works too.
  return (
    <PullToRefresh onRefresh={() => setPaginationKey((key) => key + 1)}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          title="Notes"
          actions={
            <Button variant="hanko" className="rounded-xl lg:hidden" onClick={newNote}>
              <PenLine /> New
            </Button>
          }
        />

        <SearchField
          className="mt-6"
          value={query}
          onChange={setQuery}
          placeholder="Search notes…"
        />

        {!query.trim() && (
          <Tabs
            value={view}
            onValueChange={(value) => {
              if (value === "all" || value === "shared" || value === "archived") setView(value);
            }}
            className="mt-4"
          >
            <TabsList>
              <TabsTrigger value="all">Notes</TabsTrigger>
              <TabsTrigger value="shared">Shared with me</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="mt-6">
          {!query.trim() && view === "shared" ? (
            <SharedFeed key={paginationKey} />
          ) : !query.trim() && view === "archived" ? (
            <ArchivedFeed key={paginationKey} />
          ) : (
            <NotesFeed
              key={paginationKey}
              query={query.trim()}
              debouncedQuery={debouncedQuery}
              searchResults={searchResults}
              newNote={newNote}
            />
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

function NotesFeed({
  query,
  debouncedQuery,
  searchResults,
  newNote,
}: {
  query: string;
  debouncedQuery: string;
  searchResults: Doc<"notes">[] | undefined;
  newNote: () => Promise<void>;
}) {
  const pinned = useCachedPaginatedQuery(api.notes.listPage, { pinned: true }, "notes-pinned", {
    initialNumItems: 50,
  });
  const rest = useCachedPaginatedQuery(api.notes.listPage, { pinned: false }, "notes-rest", {
    initialNumItems: 50,
  });
  const previousNotes = useCachedList<Doc<"notes">>("notes");

  useEffect(() => {
    if (pinned.isLoading || rest.isLoading) return;
    const byId = new Map<string, Doc<"notes">>();
    for (const note of [...pinned.results, ...rest.results]) byId.set(note._id, note);
    writeCachedList("notes", [...byId.values()]);
  }, [pinned.isLoading, pinned.results, rest.isLoading, rest.results]);

  const terms = useMemo(() => query.split(/\s+/).filter(Boolean), [query]);
  const hits = useMemo(
    () => (searchResults ?? []).map((note) => ({ note, terms })),
    [searchResults, terms],
  );

  if (query) {
    if (query !== debouncedQuery || searchResults === undefined) return <ListSkeleton />;
    return hits.length ? (
      <>
        <SectionLabel>Search results</SectionLabel>
        <NoteList items={hits} query={query} />
      </>
    ) : (
      <EmptyState icon={<SearchX />} title="No matching notes">
        Nothing matches “{query}”. Try fewer words, or press ⌘K to search your library too.
      </EmptyState>
    );
  }

  const pinnedNotes =
    pinned.results.length || !pinned.isLoading
      ? pinned.results
      : (previousNotes?.filter((note) => note.pinned) ?? []);
  const restNotes =
    rest.results.length || !rest.isLoading
      ? rest.results
      : (previousNotes?.filter((note) => !note.pinned) ?? []);
  if ((pinned.isLoading || rest.isLoading) && previousNotes === undefined) return <ListSkeleton />;

  const noNotes = pinnedNotes.length === 0 && restNotes.length === 0;
  if (noNotes) {
    return (
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
    );
  }

  return (
    <div className="space-y-8">
      {pinnedNotes.length > 0 && (
        <section>
          <SectionLabel>Pinned</SectionLabel>
          <NoteList
            items={pinnedNotes.map((note) => ({ note, terms: [] }))}
            status={pinned.status}
            loadMore={pinned.loadMore}
          />
        </section>
      )}
      {restNotes.length > 0 && (
        <section>
          {pinnedNotes.length > 0 && <SectionLabel>Everything else</SectionLabel>}
          <NoteList
            items={restNotes.map((note) => ({ note, terms: [] }))}
            status={rest.status}
            loadMore={rest.loadMore}
          />
        </section>
      )}
    </div>
  );
}

function SharedFeed() {
  const shared = useQuery(api.notes.sharedWithMe);
  if (shared === undefined) return <ListSkeleton />;
  if (shared.length === 0) {
    return (
      <EmptyState icon={<Users />} title="Nothing shared with you yet">
        When someone shares a note with your email, it shows up here.
      </EmptyState>
    );
  }
  return (
    <NoteList
      items={shared.map(({ note, role, ownerName }) => ({
        note,
        terms: [],
        subtitle: `${ownerName ?? "Someone"} · ${role === "edit" ? "Can edit" : "View only"}`,
      }))}
    />
  );
}

function ArchivedFeed() {
  const archived = usePaginatedQuery(
    api.notes.listPage,
    { archived: true },
    { initialNumItems: 50 },
  );
  if (archived.status === "LoadingFirstPage") return <ListSkeleton />;
  if (archived.results.length === 0) {
    return (
      <EmptyState icon={<Archive />} title="No archived notes">
        Archive a note from its ⋯ menu to tuck it away without deleting it.
      </EmptyState>
    );
  }
  return (
    <NoteList
      items={archived.results.map((note) => ({ note, terms: [] }))}
      status={archived.status}
      loadMore={archived.loadMore}
    />
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
  status,
  loadMore,
}: {
  items: { note: Doc<"notes">; terms: string[]; subtitle?: string }[];
  query?: string;
  status?: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore?: (numItems: number) => void;
}) {
  const me = useQuery(api.users.me, {});
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || status !== "CanLoadMore" || !loadMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore(50);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, status]);

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map(({ note, terms, subtitle }) => (
          <li key={note._id}>
            <NoteRowMenu note={note} query={query} isOwner={me?.id === note.userId} userId={me?.id}>
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
                  {note.archived && (
                    <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[0.7rem] font-medium text-secondary-foreground">
                      Archived
                    </span>
                  )}
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(note.updatedAt)}
                  </time>
                </div>
                {markdownToPlainText(note.body) && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    <Highlight
                      text={snippet(markdownToPlainText(note.body), terms, 90)}
                      terms={terms}
                    />
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
                {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
              </Link>
            </NoteRowMenu>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && <div ref={sentinel} aria-hidden className="h-4" />}
      {status === "LoadingMore" && (
        <div className="space-y-2 rounded-2xl border bg-card px-5 py-4" aria-label="Loading more">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      )}
    </>
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
