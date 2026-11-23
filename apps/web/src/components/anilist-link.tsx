import { useMutation } from "convex/react";
import { Link2Off, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AniListResults, handleListKey, useAniListSearch } from "#/components/anilist-results";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import {
  type AniListMedia,
  AniListError,
  catalogFor,
  catalogName,
  errorMessage,
  getCatalog,
  linkedSource,
  patchFrom,
  resolveMatch,
  samePatch,
  snapshotOf,
} from "#/lib/anilist";
import { useReadOnly } from "#/lib/offline";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";

/**
 * Fill in a series from AniList (reading kinds, anime, films) or TVmaze (TV and reality),
 * whichever covers its type. Your own names and genres are kept and the catalog's are added;
 * description, type and counts follow the catalog. Your title is left alone. Every apply can be
 * undone from the toast.
 */
export function AniListControls({ series }: { series: Doc<"series"> }) {
  const update = useMutation(api.series.update);
  const linked = linkedSource(series);
  // Linked series refresh from where they came from; otherwise search what covers the type.
  const source = linked?.source ?? catalogFor(series.kind);
  const name = catalogName(source);
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);

  async function apply(media: AniListMedia, verb: string) {
    const before = snapshotOf(series);
    const after = patchFrom(series, await resolveMatch(media));
    if (samePatch(before, after)) {
      toast(`Already up to date with ${catalogName(media.source)}`);
      return;
    }
    await update({ id: series._id, ...after });
    toast.success(verb, {
      action: { label: "Undo", onClick: () => void update({ id: series._id, ...before }) },
    });
  }

  async function refresh() {
    if (!linked) return;
    setBusy(true);
    try {
      await apply(await getCatalog(linked.source, linked.id), `Updated from ${name}`);
    } catch (err) {
      if (!(err instanceof AniListError)) console.error(err);
      toast.error(errorMessage(err, source), {
        action:
          err instanceof AniListError && err.kind === "not_found"
            ? { label: "Find again", onClick: () => setFinding(true) }
            : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    const before = { anilistId: series.anilistId ?? null, tvmazeId: series.tvmazeId ?? null };
    await update({ id: series._id, anilistId: null, tvmazeId: null });
    toast(`Unlinked from ${name}`, {
      action: { label: "Undo", onClick: () => void update({ id: series._id, ...before }) },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {linked ? (
        <>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={refresh}
            disabled={busy || readOnly}
          >
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh from {name}
          </Button>
          <Button
            variant="ghost"
            className="rounded-xl text-muted-foreground"
            onClick={() => setFinding(true)}
            disabled={readOnly}
          >
            Change match
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Unlink from ${name}`}
            className="rounded-xl text-muted-foreground"
            onClick={() => void unlink()}
            disabled={readOnly}
          >
            <Link2Off />
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => setFinding(true)}
          disabled={readOnly}
        >
          <Sparkles /> Fill in from {name}
        </Button>
      )}

      <Dialog open={finding} onOpenChange={setFinding}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl sm:max-w-md">
          {finding && (
            <FindOnAniList
              initial={series.title}
              kind={series.kind}
              selectedId={linked?.id}
              onPick={(media) => {
                setFinding(false);
                apply(media, `Filled in from ${catalogName(media.source)}`).catch(
                  (err: unknown) => {
                    if (!(err instanceof AniListError)) console.error(err);
                    toast.error(
                      err instanceof AniListError
                        ? errorMessage(err, media.source)
                        : "Couldn't save. Please try again.",
                    );
                  },
                );
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FindOnAniList({
  initial,
  kind,
  selectedId,
  onPick,
}: {
  initial: string;
  kind: Doc<"series">["kind"];
  selectedId?: number;
  onPick: (media: AniListMedia) => void;
}) {
  const [query, setQuery] = useState(initial);
  const [active, setActive] = useState(-1);
  const state = useAniListSearch(query, kind);
  const name = catalogName(catalogFor(kind));
  const results = "results" in state ? state.results : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Find on {name}</DialogTitle>
        <DialogDescription>
          Adds names and genres, and fills in the description, type and{" "}
          {kind === "tv" || kind === "reality" || kind === "anime" ? "episode" : "chapter"} count.
          Your title stays as it is.
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
        }}
        onKeyDown={(e) =>
          handleListKey(e, results.length, active, setActive, (i) => onPick(results[i]))
        }
        placeholder={`Search ${name}`}
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="anilist-find-results"
        aria-activedescendant={active >= 0 ? `anilist-find-results-${active}` : undefined}
      />
      <AniListResults
        id="anilist-find-results"
        kind={kind}
        state={state}
        active={active}
        selectedId={selectedId}
        onPick={onPick}
        onHover={setActive}
      />
    </div>
  );
}
