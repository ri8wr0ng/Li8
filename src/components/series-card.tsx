import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ExternalLink, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { Highlight } from "#/lib/highlight";
import { KIND_LABEL, STATUS_LABEL, formatChapter, readUrl } from "#/lib/series";
import { useReadOnly } from "#/lib/offline";
import { useSwipeRight } from "#/lib/swipe";
import { relativeTime } from "#/lib/time";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

export function SeriesCard({
  series,
  terms = [],
}: {
  series: Doc<"series">;
  terms?: string[];
}) {
  const bump = useMutation(api.series.bump).withOptimisticUpdate(
    (store, { id, delta }) => {
      const list = store.getQuery(api.series.list, {});
      if (list)
        store.setQuery(
          api.series.list,
          {},
          list.map((s) =>
            s._id === id
              ? { ...s, chapter: Math.max(0, s.chapter + delta) }
              : s,
          ),
        );
    },
  );
  const setChapter = useMutation(api.series.setChapter);
  const next = series.chapter + 1;
  const nextUrl = readUrl(series.readUrlTemplate, next);
  const progress = series.totalChapters
    ? Math.min(1, series.chapter / series.totalChapters)
    : null;
  const readOnly = useReadOnly();
  const swipe = useSwipeRight({
    enabled: !readOnly,
    onCommit: () => void bump({ id: series._id, delta: 1 }),
  });

  function readNext() {
    if (!nextUrl) return;
    window.open(nextUrl, "_blank", "noopener,noreferrer");
    const previous = series.chapter;
    void setChapter({ id: series._id, chapter: next }).then(() =>
      toast(`Reading Ch. ${formatChapter(next)}`, {
        action: {
          label: "Undo",
          onClick: () => void setChapter({ id: series._id, chapter: previous }),
        },
      }),
    );
  }

  return (
    // min-w-0: as a grid item the card would otherwise grow to fit the
    // un-truncated alt-names line and push the page wider than the screen.
    <div className="relative min-w-0">
      {/* Revealed behind the card as you swipe right. */}
      <div
        ref={(el) => void (swipe.reveal.current = el)}
        aria-hidden
        style={{ opacity: 0 }}
        className="group/reveal absolute inset-0 flex items-center gap-2 rounded-2xl bg-hanko pl-5 text-hanko-foreground"
      >
        <span className="grid size-10 place-items-center rounded-full bg-white/15 transition-transform duration-150 group-data-[armed=true]/reveal:scale-110">
          <Plus className="size-5" />
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          Ch. {formatChapter(next)}
        </span>
      </div>
      <Card
        ref={(el) => void (swipe.surface.current = el)}
        {...swipe.handlers}
        className="group relative min-w-0 touch-pan-y gap-0 rounded-2xl py-4 shadow-none select-none [-webkit-touch-callout:none] hover:shadow-[0_8px_24px_-14px_rgba(28,26,23,0.3)] sm:py-5"
      >
        {/* minmax(0,1fr): the header is a grid too, so its column must be allowed to shrink for truncate to work. */}
        <CardHeader className="grid-cols-[minmax(0,1fr)] gap-1 px-4 sm:px-5">
          <CardDescription className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wider uppercase">
            {KIND_LABEL[series.kind]}
            <span className="size-1 rounded-full bg-border" />
            {STATUS_LABEL[series.status]}
          </CardDescription>
          <CardTitle className="font-display text-lg leading-snug tracking-tight [overflow-wrap:anywhere]">
            <Link
              to="/library/$seriesId"
              params={{ seriesId: series._id }}
              className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            >
              <Highlight text={series.title} terms={terms} />
            </Link>
          </CardTitle>
          {series.altNames.length > 0 && (
            <CardDescription className="truncate">
              <Highlight text={series.altNames.join(" · ")} terms={terms} />
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="mt-auto flex items-end justify-between gap-3 px-4 pt-5 sm:px-5">
          <div className="min-w-0">
            <div className="text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
              Chapter
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-4xl leading-none font-semibold tabular-nums">
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

          <div className="relative z-10 flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={`One chapter back on ${series.title}`}
              disabled={series.chapter <= 0 || readOnly}
              onClick={() => void bump({ id: series._id, delta: -1 })}
              className="grid size-10 place-items-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`One chapter forward on ${series.title}`}
              disabled={readOnly}
              onClick={() => void bump({ id: series._id, delta: 1 })}
              className="grid size-12 place-items-center rounded-full bg-hanko text-hanko-foreground shadow-sm transition-transform hover:bg-hanko/90 active:scale-90 disabled:opacity-40"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </CardContent>

        {nextUrl && (
          <CardFooter className="mt-4 px-4 sm:px-5">
            <button
              type="button"
              onClick={readNext}
              disabled={readOnly}
              className="relative z-10 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-medium transition-colors hover:bg-accent"
            >
              Read Ch. {formatChapter(next)} <ExternalLink className="size-3.5" />
            </button>
          </CardFooter>
        )}

        {progress !== null && (
          <div className="absolute inset-x-5 bottom-0 h-0.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-hanko"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
