import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AniListResults, handleListKey, useAniListSearch } from "#/components/anilist-results";
import { Button } from "#/components/ui/button";
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
import { type AniListFill, type AniListMedia, fillFrom } from "#/lib/anilist";
import { useOnline, useReadOnly } from "#/lib/offline";
import {
  KIND_LABEL,
  KIND_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  parseChapterCommand,
} from "#/lib/series";
import { api } from "../../convex/_generated/api";
import type { SeriesKind, SeriesStatus } from "../../convex/validators";

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
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const online = useOnline();
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [altNames, setAltNames] = useState("");
  const [kind, setKind] = useState<SeriesKind>("manhua");
  const [status, setStatus] = useState<SeriesStatus>("reading");
  const [fill, setFill] = useState<AniListFill | null>(null);
  const [active, setActive] = useState(-1);
  const [pending, setPending] = useState(false);

  // After a pick the title is AniList's, so don't read "Kaiju No. 8" as chapter 8.
  const linked = fill !== null && title === fill.title ? fill : null;
  // Typing "Battle Through The Heavens 348" fills both fields.
  const parsed = !chapter && !linked ? parseChapterCommand(title) : null;
  const finalTitle = parsed && parsed.chapter !== undefined ? parsed.name : title.trim();
  const finalChapter = chapter ? Number(chapter) : (parsed?.chapter ?? 0);

  // Search by the name part only, and stop once a pick has filled the title.
  const searchTerm = parsed?.chapter !== undefined ? parsed.name : title;
  const anilist = useAniListSearch(searchTerm, !linked);
  const results = "results" in anilist ? anilist.results : [];

  function pick(media: AniListMedia) {
    const next = fillFrom(media);
    setFill(next);
    if (parsed?.chapter !== undefined) setChapter(String(parsed.chapter));
    setTitle(next.title);
    setAltNames(next.altNames.join(", "));
    setKind(next.kind);
    setActive(-1);
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
        chapter: finalChapter,
        kind,
        status,
        altNames: altNames.split(","),
        ...(linked
          ? {
              anilistId: linked.anilistId,
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
      toast.error("Couldn't add that series.");
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
            handleListKey(e, results.length, active, setActive, (i) => pick(results[i]))
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
            state={anilist}
            active={active}
            onPick={pick}
            onHover={setActive}
          />
        )}
        {linked && <LinkedCard fill={linked} onUnlink={unlink} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="series-chapter">Last chapter read</Label>
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
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as SeriesKind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <Select value={status} onValueChange={(v) => setStatus(v as SeriesStatus)}>
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
          Add series
        </Button>
      </DialogFooter>
    </form>
  );
}

function LinkedCard({ fill, onUnlink }: { fill: AniListFill; onUnlink: () => void }) {
  return (
    <div className="relative rounded-xl border border-dashed bg-secondary/50 p-3 pr-10 text-sm">
      <div className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">
        <Sparkles className="size-3" /> Filled from AniList
        {fill.totalChapters ? (
          <span className="ml-1 font-mono tracking-normal normal-case tabular-nums">
            · {fill.totalChapters} ch
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
        aria-label="Don't use AniList details"
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
