import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AniListResults, handleListKey, useAniListSearch } from "#/components/anilist-results";
import { Button } from "#/components/ui/button";
import { Combobox } from "#/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  type AniListFill,
  type AniListMedia,
  AniListError,
  catalogName,
  errorMessage,
  fillFrom,
  resolveMatch,
} from "#/lib/anilist";
import { useOnline, useReadOnly } from "#/lib/offline";
import {
  KIND_OPTIONS,
  STATUS_LABEL,
  STATUS_ORDER,
  isEpisodic,
  isSeriesKind,
  isSeriesStatus,
  isWatchKind,
  parseChapterCommand,
  progressLabel,
} from "#/lib/series";
import { cn } from "#/lib/utils";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Id } from "@inkmark/backend/convex/_generated/dataModel";
import type { SeriesKind, SeriesStatus } from "@inkmark/backend/convex/validators";

export function AddSeriesDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl sm:max-w-md">
        {open && <AddSeriesForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddSeriesForm({ onDone }: { onDone: () => void }) {
  const create = useMutation(api.series.create);
  const labels = useQuery(api.labels.list) ?? [];
  const createLabel = useMutation(api.labels.create);
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const online = useOnline();
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [season, setSeason] = useState("1");
  const [totalSeasons, setTotalSeasons] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<Id<"labels">[]>([]);
  const [altNames, setAltNames] = useState("");
  const [kind, setKind] = useState<SeriesKind>("manhua");
  const [status, setStatus] = useState<SeriesStatus>("reading");
  const [fill, setFill] = useState<AniListFill | null>(null);
  const [active, setActive] = useState(-1);
  const [pending, setPending] = useState(false);

  // After a pick the title is the catalog's, so don't read "Kaiju No. 8" as chapter 8.
  const linked = fill !== null && title === fill.title ? fill : null;
  // Typing "Battle Through The Heavens 348" fills both fields.
  const parsed = kind !== "movie" && !chapter && !linked ? parseChapterCommand(title) : null;
  const finalTitle = parsed && parsed.chapter !== undefined ? parsed.name : title.trim();
  const finalChapter = chapter ? Number(chapter) : (parsed?.chapter ?? 0);

  // Search by the name part only, and stop once a pick has filled the title.
  const searchTerm = parsed?.chapter !== undefined ? parsed.name : title;
  const anilist = useAniListSearch(searchTerm, kind, !linked);
  const results = "results" in anilist ? anilist.results : [];

  async function pick(media: AniListMedia) {
    setActive(-1);
    let full: AniListMedia;
    try {
      // TVmaze search leaves out seasons and other names; fetch the show first.
      full = await resolveMatch(media);
    } catch (err) {
      if (!(err instanceof AniListError)) console.error(err);
      toast.error(errorMessage(err, media.source));
      return;
    }
    const next = fillFrom(full);
    setFill(next);
    if (parsed?.chapter !== undefined) setChapter(String(parsed.chapter));
    setTitle(next.title);
    setAltNames(next.altNames.join(", "));
    setKind(next.kind);
    if (next.totalSeasons && !totalSeasons) setTotalSeasons(String(next.totalSeasons));
  }

  function unlink() {
    setFill(null);
    setAltNames("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalTitle) return;
    setPending(true);
    try {
      const id = await create({
        title: finalTitle,
        chapter: kind === "movie" ? 0 : finalChapter,
        kind,
        status,
        altNames: altNames.split(","),
        season: isEpisodic(kind) && season ? Number(season) : undefined,
        totalSeasons: isEpisodic(kind) && totalSeasons ? Number(totalSeasons) : undefined,
        labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
        ...(linked
          ? {
              anilistId: linked.anilistId,
              tvmazeId: linked.tvmazeId,
              description: linked.description,
              genres: linked.genres,
              ...(linked.totalChapters ? { totalChapters: linked.totalChapters } : {}),
            }
          : {}),
      });
      onDone();
      toast.success(`Added ${finalTitle}`, {
        action: {
          label: "Open",
          onClick: () => navigate({ to: "/library/$seriesId", params: { seriesId: id } }),
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that item.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Add to Library</DialogTitle>
        <DialogDescription>
          Start typing and pick a match to fill in the rest. Or type the name and chapter together,
          like “Solo Leveling 120”.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <Label htmlFor="series-title">Title</Label>
        <Input
          id="series-title"
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setActive(-1);
          }}
          onKeyDown={(e) =>
            handleListKey(e, results.length, active, setActive, (i) => void pick(results[i]))
          }
          placeholder="Battle Through The Heavens"
          autoComplete="off"
          enterKeyHint="done"
          role="combobox"
          aria-expanded={results.length > 0 && !linked}
          aria-controls="anilist-add-results"
          aria-activedescendant={active >= 0 ? `anilist-add-results-${active}` : undefined}
        />
        {parsed?.chapter !== undefined && (
          <p className="text-xs text-muted-foreground">
            Will add <b className="text-foreground">{parsed.name}</b> at chapter{" "}
            <b className="text-foreground">{parsed.chapter}</b>.
          </p>
        )}
        {!linked && (
          <AniListResults
            id="anilist-add-results"
            kind={kind}
            state={anilist}
            active={active}
            onPick={(media) => void pick(media)}
            onHover={setActive}
          />
        )}
        {linked && <LinkedCard fill={linked} onUnlink={unlink} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kind !== "movie" && (
          <div className="grid gap-2">
            <Label htmlFor="series-chapter">
              {progressLabel(kind) === "Episode" ? "Last episode watched" : "Last chapter read"}
            </Label>
            <Input
              id="series-chapter"
              inputMode="decimal"
              type="number"
              min={0}
              step="any"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder={parsed?.chapter !== undefined ? String(parsed.chapter) : "0"}
              className="font-mono"
            />
          </div>
        )}
        <div className={cn("grid gap-2", kind === "movie" && "col-span-2")}>
          <Label>Type</Label>
          <Combobox
            aria-label="Type"
            options={KIND_OPTIONS}
            value={kind}
            onChange={(v) => isSeriesKind(v) && setKind(v)}
            placeholder="Type"
            searchPlaceholder="Search types…"
            className="w-full"
          />
        </div>
      </div>

      {isEpisodic(kind) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="series-season">Season</Label>
            <Input
              id="series-season"
              inputMode="numeric"
              type="number"
              min={1}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="1"
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="series-total-seasons">Total seasons</Label>
            <Input
              id="series-total-seasons"
              inputMode="numeric"
              type="number"
              min={1}
              value={totalSeasons}
              onChange={(e) => setTotalSeasons(e.target.value)}
              placeholder="Optional"
              className="font-mono"
            />
          </div>
        </div>
      )}

      {/* Label picker */}
      <div className="grid gap-2">
        <Label>Labels</Label>
        <Combobox
          multiple
          aria-label="Labels"
          options={labels.map((l) => ({ value: l._id, label: l.name }))}
          value={selectedLabelIds}
          // Values are label ids, or the id of a label just created below.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          onChange={(next) => setSelectedLabelIds(next as Id<"labels">[])}
          onCreate={async (name) => {
            try {
              return await createLabel({ name });
            } catch (err) {
              console.error(err);
              toast.error("Couldn't create label.");
              return undefined;
            }
          }}
          placeholder="No labels"
          searchPlaceholder="Search or create a label…"
          emptyText="Type to create a label."
          className="w-full"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="series-alt">Alternative names</Label>
        <Input
          id="series-alt"
          value={altNames}
          onChange={(e) => setAltNames(e.target.value)}
          placeholder="BTTH, Doupo Cangqiong, 斗破苍穹"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Separate with commas. Search finds any of them.
        </p>
      </div>

      <div className="grid gap-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => isSeriesStatus(v) && setStatus(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        {readOnly && (
          <p className="mr-auto self-center text-xs text-muted-foreground">
            {online ? "Connecting…" : "You're offline."}
          </p>
        )}
        <Button
          type="submit"
          variant="hanko"
          className="rounded-xl"
          disabled={!finalTitle || pending || readOnly}
        >
          Add to library
        </Button>
      </DialogFooter>
    </form>
  );
}

function LinkedCard({ fill, onUnlink }: { fill: AniListFill; onUnlink: () => void }) {
  return (
    <div className="relative rounded-xl border border-dashed bg-secondary/50 p-3 pr-10 text-sm">
      <div className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">
        <Sparkles className="size-3" /> Filled from {catalogName(fill.source)}
        {fill.totalChapters ? (
          <span className="ml-1 font-mono tracking-normal normal-case tabular-nums">
            · {fill.totalChapters} {isWatchKind(fill.kind) ? "ep" : "ch"}
            {fill.totalSeasons && fill.totalSeasons > 1 ? ` · ${fill.totalSeasons} seasons` : ""}
          </span>
        ) : null}
      </div>
      {fill.genres.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {fill.genres.map((g) => (
            <span key={g} className="rounded-full border bg-card px-2 py-0.5 text-xs">
              {g}
            </span>
          ))}
        </div>
      )}
      {fill.description && (
        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{fill.description}</p>
      )}
      <button
        type="button"
        onClick={onUnlink}
        aria-label={`Don't use ${catalogName(fill.source)} details`}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
