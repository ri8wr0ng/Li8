import { Check, Loader2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type AniListMedia,
  AniListError,
  describeMedia,
  displayTitle,
  errorMessage,
  searchAniList,
} from "#/lib/anilist";
import { KIND_LABEL } from "#/lib/series";
import { useOnline } from "#/lib/offline";
import { cn } from "#/lib/utils";

export type AniListSearchState =
  | { status: "idle" }
  | { status: "loading"; results: AniListMedia[] }
  | { status: "done"; results: AniListMedia[] }
  | { status: "error"; message: string; results: AniListMedia[] }
  | { status: "offline" };

/** Debounced search-as-you-type. Keeps the previous results visible while the next request runs. */
export function useAniListSearch(query: string, enabled = true): AniListSearchState {
  const online = useOnline();
  const q = query.trim();
  const [state, setState] = useState<AniListSearchState>({ status: "idle" });

  useEffect(() => {
    if (!enabled || q.length < 2) {
      setState({ status: "idle" });
      return;
    }
    if (!online) {
      setState({ status: "offline" });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ status: "loading", results: "results" in s ? s.results : [] }));
    const timer = setTimeout(() => {
      searchAniList(q, controller.signal).then(
        (results) => setState({ status: "done", results }),
        (err: unknown) => {
          if (controller.signal.aborted) return;
          if (!(err instanceof AniListError)) console.error(err);
          setState((s) => ({ status: "error", message: errorMessage(err), results: "results" in s ? s.results : [] }));
        },
      );
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, enabled, online]);

  return state;
}

/** The list of matches. Keyboard focus stays in the input; `active` is driven by arrow keys there. */
export function AniListResults({
  id,
  state,
  active,
  selectedId,
  onPick,
  onHover,
  className,
}: {
  id: string;
  state: AniListSearchState;
  active: number;
  selectedId?: number;
  onPick: (media: AniListMedia) => void;
  onHover?: (index: number) => void;
  className?: string;
}) {
  if (state.status === "idle") return null;
  if (state.status === "offline") {
    return (
      <p className={cn("flex items-center gap-2 px-1 text-xs text-muted-foreground", className)}>
        <WifiOff className="size-3.5" /> AniList suggestions need a connection.
      </p>
    );
  }
  const results = state.results;
  return (
    <div className={className}>
      {results.length > 0 && (
        <ul
          id={id}
          role="listbox"
          aria-label="AniList matches"
          className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border bg-card p-1"
        >
          {results.map((media, i) => {
            const selected = media.id === selectedId;
            const original = media.title.native ?? media.title.romaji;
            return (
              <li
                key={media.id}
                id={`${id}-${i}`}
                role="option"
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
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1.5 flex min-h-4 items-center gap-1.5 px-1 text-xs text-muted-foreground" aria-live="polite">
        {state.status === "loading" ? (
          <>
            <Loader2 className="size-3 animate-spin" /> Searching AniList…
          </>
        ) : state.status === "error" ? (
          <span className="text-destructive">{state.message}</span>
        ) : results.length === 0 ? (
          "No AniList match. You can still add it by hand."
        ) : (
          "Pick one to fill in the details from AniList."
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
