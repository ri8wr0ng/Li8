import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BookOpen, Plus, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddSeriesDialog } from "#/components/add-series-dialog";
import { EmptyState, PageHeader, SearchField, SectionLabel } from "#/components/page";
import { PullToRefresh } from "#/components/pull-to-refresh";
import { SeriesCard } from "#/components/series-card";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { useCachedList, useCachedPaginatedQuery, writeCachedList } from "#/lib/offline";
import { isSeriesKind, isSeriesStatus, KIND_LABEL, KIND_ORDER, STATUS_LABEL } from "#/lib/series";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { SeriesKind, SeriesStatus } from "../../../convex/validators";

type Filter = SeriesStatus | "all";

type TypeFilter = "all" | "read" | "watch" | SeriesKind;

interface LibrarySearch {
  status?: Filter;
  type?: TypeFilter;
  label?: string;
}

const isTypeFilter = (t: unknown): t is TypeFilter =>
  t === "all" || t === "read" || t === "watch" || isSeriesKind(t);

export const Route = createFileRoute("/_app/library/")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => {
    const s = search.status;
    const t = search.type;
    const l = search.label;

    return {
      status: s === "all" || isSeriesStatus(s) ? s : undefined,
      type: isTypeFilter(t) ? t : undefined,
      label: typeof l === "string" && l.length > 0 ? l : undefined,
    };
  },
  component: LibraryPage,
});

const STATUS_CHIPS: Filter[] = ["reading", "planned", "on_hold", "completed", "dropped", "all"];

function LibraryPage() {
  const { status = "reading", type = "all", label } = Route.useSearch();
  const navigate = Route.useNavigate();

  const labels = useQuery(api.labels.list);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim();

  const searchResults = useQuery(
    api.library.search,
    debouncedQuery ? { query: debouncedQuery } : "skip",
  );

  const terms = useMemo(() => debouncedQuery.split(/\s+/).filter(Boolean), [debouncedQuery]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          title="Library"
          actions={
            <AddSeriesDialog>
              <Button variant="hanko" className="rounded-xl">
                <Plus /> Add to library
              </Button>
            </AddSeriesDialog>
          }
        />

        <SearchField
          className="mt-6"
          value={query}
          onChange={setQuery}
          placeholder="Search titles and alternative names…"
        />

        {!q && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <div role="tablist" aria-label="Filter by status" className="flex w-max gap-1.5">
                {STATUS_CHIPS.map((f) => (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={status === f}
                    onClick={() =>
                      void navigate({
                        search: (prev) => ({
                          ...prev,
                          status: f === "reading" ? undefined : f,
                        }),
                        replace: true,
                      })
                    }
                    className={cn(
                      "flex h-9 items-center rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
                      status === f
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f === "all" ? "All" : STATUS_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={type}
                onValueChange={(val) =>
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      type: val === "all" || !isTypeFilter(val) ? undefined : val,
                    }),
                    replace: true,
                  })
                }
              >
                <SelectTrigger className="h-9 rounded-full border border-border bg-card px-3 text-xs sm:text-sm">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="read">Reading</SelectItem>
                  <SelectItem value="watch">Watching</SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Specific kind</SelectLabel>
                    {KIND_ORDER.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={label ?? "all"}
                onValueChange={(val) =>
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      label: val === "all" ? undefined : val,
                    }),
                    replace: true,
                  })
                }
              >
                <SelectTrigger className="h-9 rounded-full border border-border bg-card px-3 text-xs sm:text-sm">
                  <SelectValue placeholder="All labels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All labels</SelectItem>
                  {labels && labels.length > 0 && <SelectSeparator />}
                  {labels?.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="mt-6">
          {q ? (
            searchResults === undefined ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <SectionLabel>
                  {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
                </SectionLabel>
                <Grid>
                  {searchResults.map((s) => (
                    <SeriesCard key={s._id} series={s} terms={terms} />
                  ))}
                </Grid>
              </>
            ) : (
              <EmptyState icon={<SearchX />} title="Not in your library">
                Nothing matches “{q}”.
                <div className="mt-4">
                  <AddSeriesDialog>
                    <Button variant="outline" className="rounded-xl">
                      <Plus /> Add to library
                    </Button>
                  </AddSeriesDialog>
                </div>
              </EmptyState>
            )
          ) : label && labels === undefined ? null : (
            <LibraryList
              key={refreshKey}
              status={status}
              type={type}
              labelId={labels?.find((l) => l._id === label)?._id}
            />
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

function LibraryList({
  status,
  type,
  labelId,
}: {
  status: Filter;
  type: TypeFilter;
  labelId: Id<"labels"> | undefined;
}) {
  const queryArgs = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      type: type === "all" ? undefined : type,
      labelId,
    }),
    [status, type, labelId],
  );

  // Each filter keeps its own saved copy, so switching filters never flashes another filter's items.
  const {
    results,
    status: paginationStatus,
    loadMore,
    isLoading,
  } = useCachedPaginatedQuery(
    api.library.listPage,
    queryArgs,
    `series:${status}:${type}:${labelId ?? ""}`,
    { initialNumItems: 50 },
  );

  // Everything loaded so far also goes into the shared "series" copy the detail page reads offline.
  const saved = useCachedList<Doc<"series">>("series");
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);
  useEffect(() => {
    if (isLoading || results.length === 0) return;
    const byId = new Map((savedRef.current ?? []).map((s) => [s._id, s]));
    for (const s of results) byId.set(s._id, s);
    writeCachedList("series", [...byId.values()].slice(-1000));
  }, [isLoading, results]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || paginationStatus !== "CanLoadMore") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore(50);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [paginationStatus, loadMore]);

  if (isLoading && results.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }

  const seriesList = results;

  if (seriesList.length === 0) {
    const isFiltered = status !== "reading" || (type && type !== "all") || labelId !== undefined;
    if (isFiltered) {
      const statusTitle = status === "all" ? "All" : STATUS_LABEL[status];
      return <EmptyState icon={<BookOpen />} title={`Nothing in “${statusTitle}”`} />;
    }

    return (
      <EmptyState icon={<BookOpen />} title="Track what you're reading">
        Add a series once, then bump the chapter with one tap — or press ⌘K and type{" "}
        <span className="font-mono">btth 349</span>.
        <div className="mt-5">
          <AddSeriesDialog>
            <Button variant="hanko" className="rounded-xl">
              <Plus /> Add to library
            </Button>
          </AddSeriesDialog>
        </div>
      </EmptyState>
    );
  }

  return (
    <>
      <Grid>
        {seriesList.map((s) => (
          <SeriesCard key={s._id} series={s} />
        ))}
      </Grid>

      {paginationStatus === "LoadingMore" && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
