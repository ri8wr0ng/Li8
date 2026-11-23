import { Check, Loader2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type AniListMedia,
  AniListError,
  catalogFor,
  catalogName,
  describeMedia,
  displayTitle,
  errorMessage,
  searchCatalog,
} from "#/lib/anilist";
import { KIND_LABEL } from "#/lib/series";
import { useOnline } from "#/lib/offline";
import type { SeriesKind } from "@inkmark/backend/convex/validators";
import { cn } from "#/lib/utils";

export type AniListSearchState =
  | { status: "idle" }
  | { status: "loading"; results: AniListMedia[] }
  | { status: "done"; results: AniListMedia[] }
  | { status: "error"; message: string; results: AniListMedia[] }
  | { status: "offline" };

/**
 * Debounced search-as-you-type in the catalog for `kind` (AniList or TVmaze). Keeps the previous
 * results visible while the next request runs.
 */
export function useAniListSearch(
  query: string,
  kind: SeriesKind,
  enabled = true,
): AniListSearchState {
  const online = useOnline();
  const q = query.trim();
  const source = catalogFor(kind);
  const searchKind = kind;
  // The last finished request. Loading is derived: it's whenever that request was for another query.
  const [fetched, setFetched] = useState<{
    q: string;
    results: AniListMedia[];
    error?: string;
  } | null>(null);
  // Results are per catalog and type: anime and manga searches differ for the same words.
  const key = `${source}:${searchKind}:${q}`;

  const idle = !enabled || q.length < 2;

  useEffect(() => {
    if (idle || !online) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalog(q, searchKind, controller.signal).then(
        (results) => setFetched({ q: key, results }),
        (err: unknown) => {
          if (controller.signal.aborted) return;
          if (!(err instanceof AniListError)) console.error(err);
          setFetched((f) => ({
            q: key,
            results: f?.results ?? [],
            error: errorMessage(err, source),
          }));
        },
      );
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, key, searchKind, source, idle, online]);

  if (idle) return { status: "idle" };
  if (!online) return { status: "offline" };
  const results = fetched?.results ?? [];
  if (fetched?.q !== key) return { status: "loading", results };
  if (fetched.error !== undefined) return { status: "error", message: fetched.error, results };
  return { status: "done", results };
}

/** The list of matches. Keyboard focus stays in the input; `active` is driven by arrow keys there. */
export function AniListResults({
  id,
  kind,
  state,
  active,
  selectedId,
  onPick,
  onHover,
  className,
}: {
  id: string;
  kind: SeriesKind;
  state: AniListSearchState;
  active: number;
  selectedId?: number;
  onPick: (media: AniListMedia) => void;
  onHover?: (index: number) => void;
  className?: string;
}) {
  const name = catalogName(catalogFor(kind));
  if (state.status === "idle") return null;
  if (state.status === "offline") {
    return (
      <p className={cn("flex items-center gap-2 px-1 text-xs text-muted-foreground", className)}>
        <WifiOff className="size-3.5" /> {name} suggestions need a connection.
      </p>
    );
  }
  const results = state.results;
  return (
    <div className={className}>
      {results.length > 0 && (
        <div
          id={id}
          role="listbox"
          aria-label={`${name} matches`}
          className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border bg-card p-1"
        >
          {results.map((media, i) => {
            const selected = media.id === selectedId;
            const original = media.title.native ?? media.title.romaji;
            return (
              // Keyboard selection is handled by the combobox input (aria-activedescendant).
              // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
              <div
                key={media.id}
                id={`${id}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onPick(media)}
                onPointerEnter={() => onHover?.(i)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 select-none",
                  i === active && "bg-accent",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{displayTitle(media)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {original && original !== displayTitle(media) ? `${original} · ` : ""}
                    {describeMedia(media, (k) => KIND_LABEL[k])}
                  </div>
                </div>
                {selected && <Check className="mt-0.5 size-4 shrink-0 text-hanko" />}
              </div>
            );
          })}
        </div>
      )}
      <p
        className="mt-1.5 flex min-h-4 items-center gap-1.5 px-1 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {state.status === "loading" ? (
          <>
            <Loader2 className="size-3 animate-spin" /> Searching {name}…
          </>
        ) : state.status === "error" ? (
          <span className="text-destructive">{state.message}</span>
        ) : results.length === 0 ? (
          `No ${name} match. You can still add it by hand.`
        ) : (
          `Pick one to fill in the details from ${name}.`
        )}
      </p>
    </div>
  );
}

/** Arrow/Enter/Escape handling for an input that drives <AniListResults>. Returns true when it handled the key. */
export function handleListKey(
  e: Pick<React.KeyboardEvent, "key" | "preventDefault" | "stopPropagation">,
  count: number,
  active: number,
  setActive: (i: number) => void,
  pick: (i: number) => void,
) {
  if (count === 0) return false;
  if (e.key === "ArrowDown") {
    setActive((active + 1) % count);
  } else if (e.key === "ArrowUp") {
    setActive(active <= 0 ? count - 1 : Math.min(active - 1, count - 1));
  } else if (e.key === "Enter" && active >= 0) {
    if (active < count) pick(active);
    else setActive(-1);
  } else if (e.key === "Escape" && active >= 0) {
    setActive(-1);
  } else {
    return false;
  }
  e.preventDefault();
  e.stopPropagation();
  return true;
}
