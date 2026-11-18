import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronRight, ExternalLink, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Highlight } from "#/lib/highlight";
import {
  KIND_LABEL,
  formatChapter,
  isEpisodic,
  isWatchKind,
  progressLabel,
  nextReadUrl,
  statusLabel,
} from "#/lib/series";
import { useReadOnly } from "#/lib/offline";
import { useSwipeRight, vibrate } from "#/lib/swipe";
import { relativeTime } from "#/lib/time";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";

export function SeriesCard({ series, terms = [] }: { series: Doc<"series">; terms?: string[] }) {
  const bump = useMutation(api.series.bump).withOptimisticUpdate((store, { id, delta }) => {
    // Every loaded page of every filter: the Library always passes filter args.
    for (const { args, value } of store.getAllQueries(api.library.listPage)) {
      if (!value || !value.page.some((s) => s._id === id)) continue;
      store.setQuery(api.library.listPage, args, {
        ...value,
        page: value.page.map((s) =>
          s._id === id ? { ...s, chapter: Math.max(0, s.chapter + delta) } : s,
        ),
      });
    }
  });
  const update = useMutation(api.series.update);
  const setChapter = useMutation(api.series.setChapter);
  const allLabels = useQuery(api.labels.list);
  const next = series.chapter + 1;
  const nextUrl = nextReadUrl(series, next);
  const progress = series.totalChapters ? Math.min(1, series.chapter / series.totalChapters) : null;
  const readOnly = useReadOnly();
  const episodic = isEpisodic(series.kind);
  const isMovie = series.kind === "movie";

  const {
    attachSurface,
    attachReveal,
    handlers: swipeHandlers,
  } = useSwipeRight({
    enabled: !readOnly && !isMovie,
    onCommit: () => void bump({ id: series._id, delta: 1 }),
  });

  function readNext() {
    if (!nextUrl) return;
    window.open(nextUrl, "_blank", "noopener,noreferrer");
    const previous = series.chapter;
    const toastPrefix = isWatchKind(series.kind) ? "Watching" : "Reading";
    const labelPrefix = episodic
      ? `S${series.season ?? 1} · E${formatChapter(next)}`
      : `${progressLabel(series.kind)} ${formatChapter(next)}`;
    void setChapter({ id: series._id, chapter: next }).then(() =>
      toast(`${toastPrefix} ${labelPrefix}`, {
        action: {
          label: "Undo",
          onClick: () => void setChapter({ id: series._id, chapter: previous }),
        },
      }),
    );
  }

  const revealText = episodic
    ? `S${series.season ?? 1} · E${formatChapter(next)}`
    : `${isWatchKind(series.kind) ? "Ep." : "Ch."} ${formatChapter(next)}`;

  return (
    // min-w-0: as a grid item the card would otherwise grow to fit the
    // un-truncated alt-names line and push the page wider than the screen.
    <div className="relative min-w-0">
      {/* Revealed behind the card as you swipe right. */}
      {!isMovie && (
        <div
          ref={attachReveal}
          aria-hidden
          style={{ opacity: 0 }}
          className="group/reveal absolute inset-0 flex items-center gap-2 rounded-2xl bg-hanko pl-5 text-hanko-foreground"
        >
          <span className="grid size-10 place-items-center rounded-full bg-white/15 transition-transform duration-150 group-data-[armed=true]/reveal:scale-110">
            <Plus className="size-5" />
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">{revealText}</span>
        </div>
      )}
      <Card
        ref={attachSurface}
        {...swipeHandlers}
        className="group relative min-w-0 touch-pan-y gap-0 rounded-2xl py-4 shadow-none select-none [-webkit-touch-callout:none] hover:shadow-[0_8px_24px_-14px_rgba(28,26,23,0.3)] sm:py-5"
      >
        {/* minmax(0,1fr): the header is a grid too, so its column must be allowed to shrink for truncate to work. */}
        <CardHeader className="grid-cols-[minmax(0,1fr)] gap-1 px-4 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
          <CardDescription className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wider uppercase">
            {KIND_LABEL[series.kind]}
            <span className="size-1 rounded-full bg-border" />
            {statusLabel(series.status, series.kind)}
          </CardDescription>
          <CardTitle className="font-display text-lg leading-snug tracking-tight [overflow-wrap:anywhere]">
            <Highlight text={series.title} terms={terms} />
          </CardTitle>
          <CardAction>
            <Link
              to="/library/$seriesId"
              params={{ seriesId: series._id }}
              aria-label={`Open ${series.title}`}
              className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
            >
              <ChevronRight className="size-5" />
            </Link>
          </CardAction>
          {series.altNames.length > 0 && (
            <CardDescription className="col-start-1 truncate">
              <Highlight text={series.altNames.join(" · ")} terms={terms} />
            </CardDescription>
          )}
          {series.labelIds && series.labelIds.length > 0 && allLabels && (
            <div className="col-start-1 flex flex-wrap gap-1 pt-1">
              {series.labelIds.map((lid) => {
                const label = allLabels.find((l) => l._id === lid);
                if (!label) return null;
                return (
                  <span
                    key={lid}
                    className="rounded-md border bg-secondary/60 px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground"
                  >
                    {label.name}
                  </span>
                );
              })}
            </div>
          )}
        </CardHeader>

        {isMovie ? (
          <CardContent className="mt-auto flex items-center justify-between gap-3 px-4 pt-5 sm:px-5">
            <div className="text-xs text-muted-foreground">{relativeTime(series.lastReadAt)}</div>
            {series.status !== "completed" ? (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => void update({ id: series._id, status: "completed" })}
                className="flex h-9 items-center justify-center rounded-xl bg-hanko px-3.5 text-xs font-medium text-hanko-foreground shadow-sm transition-transform hover:bg-hanko/90 active:scale-95 disabled:opacity-40"
              >
                Mark watched
              </button>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Watched</span>
            )}
          </CardContent>
        ) : (
          <CardContent className="mt-auto flex items-end justify-between gap-3 px-4 pt-5 sm:px-5">
            <div className="min-w-0">
              <div className="text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                {episodic ? "Episode" : "Chapter"}
              </div>
              <div className="flex items-baseline gap-1.5">
                {episodic && (
                  <span className="font-mono text-sm font-semibold text-muted-foreground tabular-nums">
                    S{series.season ?? 1}
                  </span>
                )}
                <span className="font-mono text-4xl leading-none font-semibold tabular-nums">
                  {episodic && <span className="text-2xl text-muted-foreground">E</span>}
                  {formatChapter(series.chapter)}
                </span>
                {series.totalChapters && (
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">
                    / {formatChapter(series.totalChapters)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {relativeTime(series.lastReadAt)}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label={`One back on ${series.title}`}
                disabled={series.chapter <= 0 || readOnly}
                onClick={() => void bump({ id: series._id, delta: -1 })}
                className="grid size-10 place-items-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`One forward on ${series.title}`}
                disabled={readOnly}
                onClick={() => {
                  vibrate(8); // same tick as the swipe commit (Android; no-op on iOS)
                  void bump({ id: series._id, delta: 1 });
                }}
                className="grid size-12 place-items-center rounded-full bg-hanko text-hanko-foreground shadow-sm transition-transform hover:bg-hanko/90 active:scale-90 disabled:opacity-40"
              >
                <Plus className="size-5" />
              </button>
            </div>
          </CardContent>
        )}

        {nextUrl && (
          <CardFooter className="mt-4 px-4 sm:px-5">
            <button
              type="button"
              onClick={readNext}
              disabled={readOnly}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-medium transition-colors hover:bg-accent"
            >
              {isWatchKind(series.kind) ? "Watch" : "Read"}{" "}
              {episodic
                ? `S${series.season ?? 1} · E${formatChapter(next)}`
                : `${progressLabel(series.kind)} ${formatChapter(next)}`}{" "}
              <ExternalLink className="size-3.5" />
            </button>
          </CardFooter>
        )}

        {progress !== null && !isMovie && (
          <div className="absolute inset-x-5 bottom-0 h-0.5 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-hanko" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </Card>
    </div>
  );
}
