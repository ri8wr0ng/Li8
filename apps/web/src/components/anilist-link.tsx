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
import { type AniListMedia, AniListError, errorMessage, fillFrom, getAniList } from "#/lib/anilist";
import { useReadOnly } from "#/lib/offline";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";

type Patch = {
  anilistId: number | null;
  altNames: string[];
  description: string;
  genres: string[];
  kind: Doc<"series">["kind"];
  totalChapters: number | null;
};

function merge(existing: string[], incoming: (string | null | undefined)[]) {
  const seen = new Set(existing.map((v) => v.toLowerCase()));
  const out = [...existing];
  for (const v of incoming) {
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

function snapshot(series: Doc<"series">): Patch {
  return {
    anilistId: series.anilistId ?? null,
    altNames: series.altNames,
    description: series.description,
    genres: series.genres,
    kind: series.kind,
    totalChapters: series.totalChapters ?? null,
  };
}

/**
 * Pull details from AniList into a series. Your own names and genres are kept
 * and AniList's are added; description, type and chapter count follow AniList.
 * Your title is left alone. Every apply can be undone from the toast.
 */
function patchFrom(series: Doc<"series">, media: AniListMedia): Patch {
  const fill = fillFrom(media);
  const names = [fill.title, ...fill.altNames].filter(
    (n) => n.toLowerCase() !== series.title.toLowerCase(),
  );
  return {
    anilistId: fill.anilistId,
    altNames: merge(series.altNames, names),
    description: fill.description || series.description,
    genres: merge(series.genres, fill.genres),
    kind: fill.kind,
    totalChapters: fill.totalChapters ?? series.totalChapters ?? null,
  };
}

const same = (a: Patch, b: Patch) => JSON.stringify(a) === JSON.stringify(b);

export function AniListControls({ series }: { series: Doc<"series"> }) {
  const update = useMutation(api.series.update);
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);

  async function apply(media: AniListMedia, verb: string) {
    const before = snapshot(series);
    const after = patchFrom(series, media);
    if (same(before, after)) {
      toast("Already up to date with AniList");
      return;
    }
    await update({ id: series._id, ...after });
    toast.success(verb, {
      action: { label: "Undo", onClick: () => void update({ id: series._id, ...before }) },
    });
  }

  async function refresh() {
    if (!series.anilistId) return;
    setBusy(true);
    try {
      await apply(await getAniList(series.anilistId), "Updated from AniList");
    } catch (err) {
      if (!(err instanceof AniListError)) console.error(err);
      toast.error(errorMessage(err), {
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
    await update({ id: series._id, anilistId: null });
    toast("Unlinked from AniList", {
      action: {
        label: "Undo",
        onClick: () => void update({ id: series._id, anilistId: series.anilistId ?? null }),
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {series.anilistId ? (
        <>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={refresh}
            disabled={busy || readOnly}
          >
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh from AniList
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
            aria-label="Unlink from AniList"
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
          <Sparkles /> Fill in from AniList
        </Button>
      )}

      <Dialog open={finding} onOpenChange={setFinding}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl sm:max-w-md">
          {finding && (
            <FindOnAniList
              initial={series.title}
              selectedId={series.anilistId}
              onPick={(media) => {
                setFinding(false);
                apply(media, "Filled in from AniList").catch((err: unknown) => {
                  console.error(err);
                  toast.error("Couldn't save. Please try again.");
                });
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
  selectedId,
  onPick,
}: {
  initial: string;
  selectedId?: number;
  onPick: (media: AniListMedia) => void;
}) {
  const [query, setQuery] = useState(initial);
  const [active, setActive] = useState(-1);
  const state = useAniListSearch(query);
  const results = "results" in state ? state.results : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Find on AniList</DialogTitle>
        <DialogDescription>
          Adds names and genres, and fills in the description, type and chapter count. Your title
          stays as it is.
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
        placeholder="Search AniList"
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="anilist-find-results"
        aria-activedescendant={active >= 0 ? `anilist-find-results-${active}` : undefined}
      />
      <AniListResults
        id="anilist-find-results"
        state={state}
        active={active}
        selectedId={selectedId}
        onPick={onPick}
        onHover={setActive}
      />
    </div>
  );
}
