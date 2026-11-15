import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookX,
  ExternalLink,
  FastForward,
  Minus,
  Pencil,
  Plus,
  Settings2,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AniListControls } from "#/components/anilist-link";
import { ChipInput } from "#/components/chip-input";
import { EmptyState } from "#/components/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Combobox } from "#/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  KIND_OPTIONS,
  STATUS_ORDER,
  formatChapter,
  isEpisodic,
  isSeriesKind,
  isSeriesStatus,
  isWatchKind,
  progressLabel,
  readUrl,
  statusLabel,
} from "#/lib/series";
import { useCachedList, useOnline, useReadOnly } from "#/lib/offline";
import { pageTitle, useDocumentTitle } from "#/lib/seo";
import { fullDate, relativeTime } from "#/lib/time";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/_app/library/$seriesId")({
  head: () => ({ meta: [{ title: pageTitle("Series") }] }),
  component: SeriesPage,
  errorComponent: Missing,
});

function SeriesPage() {
  const { seriesId } = Route.useParams();
  const { isAuthenticated } = useConvexAuth();
  const online = useOnline();
  const live = useQuery(
    api.series.get,
    // Route params are plain strings; the query validates the id with v.id().
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    isAuthenticated ? { id: seriesId as Id<"series"> } : "skip",
  );
  // Until the live copy arrives (or with no connection), show the saved one.
  const cachedList = useCachedList<Doc<"series">>("series");
  const cached = cachedList?.find((s) => s._id === seriesId);
  const series = live !== undefined ? live : (cached ?? (cachedList && !online ? null : undefined));
  useDocumentTitle(series?.title);
  if (series === undefined) return null;
  if (series === null) return <Missing />;
  return <SeriesDetail key={series._id} series={series} />;
}

function Missing() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <EmptyState icon={<BookX />} title="This series isn't in your library">
        <div className="mt-4">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/library">Back to Library</Link>
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}

function SeriesDetail({ series }: { series: Doc<"series"> }) {
  const update = useMutation(api.series.update);
  const setChapter = useMutation(api.series.setChapter);
  const nextSeason = useMutation(api.series.nextSeason);
  const bump = useMutation(api.series.bump);
  const remove = useMutation(api.series.remove);
  const history = useQuery(api.series.history, { seriesId: series._id });
  const allLabels = useQuery(api.labels.list) ?? [];
  const createLabel = useMutation(api.labels.create);
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const episodic = isEpisodic(series.kind);
  const isMovie = series.kind === "movie";

  const save = (patch: Omit<Parameters<typeof update>[0], "id">) =>
    update({ id: series._id, ...patch }).catch((err: unknown) => {
      console.error(err);
      toast.error("Couldn't save. Please try again.");
    });

  const nextUrl = readUrl(series.readUrlTemplate, series.chapter + 1);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
      <div className="flex h-14 items-center">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 rounded-xl text-muted-foreground"
        >
          <Link to="/library">
            <ArrowLeft /> Library
          </Link>
        </Button>
      </div>

      {/* Offline, the whole page becomes a read-only view of the saved copy. */}
      <fieldset disabled={readOnly} className="contents">
        <BlurField
          value={series.title}
          onCommit={(title) => (title.trim() ? void save({ title }) : false)}
          aria-label="Title"
          className="w-full bg-transparent font-display text-3xl leading-tight font-semibold tracking-[-0.02em] outline-none sm:text-4xl"
        />

        <div className="mt-3">
          <ChipInput
            value={series.altNames}
            onChange={(altNames) => void save({ altNames })}
            placeholder={
              series.altNames.length
                ? "Add another name"
                : "Add alternative names (BTTH, 斗破苍穹…)"
            }
          />
        </div>

        {/* Labels */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {allLabels
            .filter((l) => series.labelIds?.includes(l._id))
            .map((l) => (
              <span
                key={l._id}
                className="rounded-full bg-hanko px-2.5 py-1 text-xs font-medium text-hanko-foreground"
              >
                {l.name}
              </span>
            ))}
          <Combobox
            multiple
            aria-label="Labels"
            options={allLabels.map((l) => ({ value: l._id, label: l.name }))}
            value={series.labelIds ?? []}
            onChange={(next) => void save({ labelIds: asLabelIds(next) })}
            onCreate={async (name) => {
              try {
                return await createLabel({ name });
              } catch (err) {
                console.error(err);
                toast.error("Couldn't create label.");
                return undefined;
              }
            }}
            placeholder="Labels"
            searchPlaceholder="Search or create a label…"
            emptyText="Type to create a label."
            disabled={readOnly}
            className="h-7 rounded-full border-dashed px-2.5 text-xs text-muted-foreground shadow-none"
          >
            <span className="flex items-center gap-1">
              <Tag className="size-3" />
              {series.labelIds?.length ? "Edit labels" : "Add labels"}
            </span>
          </Combobox>
          <ManageLabelsDialog disabled={readOnly} />
        </div>

        {/* Progress / Chapter Section */}
        {isMovie ? (
          <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Label className="text-[0.7rem] font-medium tracking-widest text-muted-foreground uppercase">
                  Movie Status
                </Label>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold">
                    {statusLabel(series.status, series.kind)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {relativeTime(series.lastReadAt)}
                </p>
              </div>
              {series.status !== "completed" ? (
                <Button
                  type="button"
                  variant="hanko"
                  disabled={readOnly}
                  onClick={() => void save({ status: "completed" })}
                  className="rounded-xl"
                >
                  Mark watched
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => void save({ status: "reading" })}
                  className="rounded-xl"
                >
                  Mark unwatched
                </Button>
              )}
            </div>
          </section>
        ) : episodic ? (
          <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="chapter"
                    className="text-[0.7rem] font-medium tracking-widest text-muted-foreground uppercase"
                  >
                    Episode progress
                  </Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    (Season {series.season ?? 1}
                    {series.totalSeasons ? ` of ${series.totalSeasons}` : ""})
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-lg font-semibold text-muted-foreground tabular-nums">
                    S{series.season ?? 1}
                  </span>
                  <span className="-mr-2 font-mono text-3xl font-semibold text-muted-foreground">
                    E
                  </span>
                  <ChapterInput
                    id="chapter"
                    value={series.chapter}
                    onCommit={(chapter) => void setChapter({ id: series._id, chapter })}
                  />
                  <span className="font-mono text-lg text-muted-foreground">
                    /{" "}
                    <BlurField
                      value={series.totalChapters ? formatChapter(series.totalChapters) : ""}
                      placeholder="?"
                      inputMode="decimal"
                      aria-label="Total episodes this season"
                      onCommit={(v) => {
                        const n = Number(v);
                        void save({
                          totalChapters: v.trim() && Number.isFinite(n) && n > 0 ? n : null,
                        });
                      }}
                      className="w-20 bg-transparent font-mono tabular-nums outline-none placeholder:text-muted-foreground/60"
                    />
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {relativeTime(series.lastReadAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => {
                    void nextSeason({ id: series._id }).then(() =>
                      toast.success("Started next season"),
                    );
                  }}
                  className="rounded-xl gap-1.5"
                >
                  <FastForward className="size-4" /> Next season
                </Button>
                <button
                  type="button"
                  aria-label="One episode back"
                  disabled={series.chapter <= 0}
                  onClick={() => void bump({ id: series._id, delta: -1 })}
                  className="grid size-12 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-40"
                >
                  <Minus className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="One episode forward"
                  onClick={() => void bump({ id: series._id, delta: 1 })}
                  className="grid size-14 place-items-center rounded-full bg-hanko text-hanko-foreground shadow-sm hover:bg-hanko/90 active:scale-90"
                >
                  <Plus className="size-6" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>Current season:</span>
                <BlurField
                  value={String(series.season ?? 1)}
                  placeholder="1"
                  inputMode="numeric"
                  aria-label="Current season"
                  onCommit={(v) => {
                    const n = Number(v);
                    if (v.trim() && Number.isFinite(n) && n >= 1) {
                      void save({ season: n });
                    }
                  }}
                  className="w-12 rounded border bg-background px-1.5 py-0.5 text-center font-mono text-foreground"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>Total seasons:</span>
                <BlurField
                  value={series.totalSeasons ? String(series.totalSeasons) : ""}
                  placeholder="—"
                  inputMode="numeric"
                  aria-label="Total seasons"
                  onCommit={(v) => {
                    const n = Number(v);
                    void save({
                      totalSeasons: v.trim() && Number.isFinite(n) && n > 0 ? n : null,
                    });
                  }}
                  className="w-12 rounded border bg-background px-1.5 py-0.5 text-center font-mono text-foreground"
                />
              </div>
            </div>

            {series.totalChapters ? (
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-hanko transition-[width]"
                  style={{
                    width: `${Math.min(100, (series.chapter / series.totalChapters) * 100)}%`,
                  }}
                />
              </div>
            ) : null}

            {nextUrl && (
              <Button asChild variant="secondary" className="mt-5 w-full rounded-xl sm:w-auto">
                <a href={nextUrl} target="_blank" rel="noopener noreferrer">
                  Watch S{series.season ?? 1} · E{formatChapter(series.chapter + 1)}{" "}
                  <ExternalLink />
                </a>
              </Button>
            )}
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <Label
                  htmlFor="chapter"
                  className="text-[0.7rem] font-medium tracking-widest text-muted-foreground uppercase"
                >
                  Last chapter read
                </Label>
                <div className="mt-1 flex items-baseline gap-2">
                  <ChapterInput
                    id="chapter"
                    value={series.chapter}
                    onCommit={(chapter) => void setChapter({ id: series._id, chapter })}
                  />
                  <span className="font-mono text-lg text-muted-foreground">
                    /{" "}
                    <BlurField
                      value={series.totalChapters ? formatChapter(series.totalChapters) : ""}
                      placeholder="?"
                      inputMode="decimal"
                      aria-label="Total chapters"
                      onCommit={(v) => {
                        const n = Number(v);
                        void save({
                          totalChapters: v.trim() && Number.isFinite(n) && n > 0 ? n : null,
                        });
                      }}
                      className="w-20 bg-transparent font-mono tabular-nums outline-none placeholder:text-muted-foreground/60"
                    />
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updated {relativeTime(series.lastReadAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="One chapter back"
                  disabled={series.chapter <= 0}
                  onClick={() => void bump({ id: series._id, delta: -1 })}
                  className="grid size-12 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-40"
                >
                  <Minus className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="One chapter forward"
                  onClick={() => void bump({ id: series._id, delta: 1 })}
                  className="grid size-14 place-items-center rounded-full bg-hanko text-hanko-foreground shadow-sm hover:bg-hanko/90 active:scale-90"
                >
                  <Plus className="size-6" />
                </button>
              </div>
            </div>

            {series.totalChapters ? (
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-hanko transition-[width]"
                  style={{
                    width: `${Math.min(100, (series.chapter / series.totalChapters) * 100)}%`,
                  }}
                />
              </div>
            ) : null}

            {nextUrl && (
              <Button asChild variant="secondary" className="mt-5 w-full rounded-xl sm:w-auto">
                <a href={nextUrl} target="_blank" rel="noopener noreferrer">
                  Read Ch. {formatChapter(series.chapter + 1)} <ExternalLink />
                </a>
              </Button>
            )}
          </section>
        )}

        {/* Details */}
        <section className="mt-8 grid gap-6">
          <AniListControls series={series} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Combobox
                aria-label="Type"
                options={KIND_OPTIONS}
                value={series.kind}
                onChange={(kind) => isSeriesKind(kind) && void save({ kind })}
                placeholder="Type"
                searchPlaceholder="Search types…"
                className="w-full rounded-xl"
              />
            </Field>
            <Field label="Status">
              <Select
                value={series.status}
                onValueChange={(status) => isSeriesStatus(status) && void save({ status })}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s, series.kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Description">
            <BlurTextarea
              value={series.description}
              onCommit={(description) => void save({ description })}
              placeholder="What's it about? Where did you hear about it?"
            />
          </Field>

          <Field label="Genres">
            <div className="rounded-xl border bg-card px-3 py-2">
              <ChipInput
                value={series.genres}
                onChange={(genres) => void save({ genres })}
                placeholder="Cultivation, Action, Fantasy…"
              />
            </div>
          </Field>

          <Field
            label={isWatchKind(series.kind) ? "Watching link" : "Reading link"}
            hint={
              <>
                Paste a chapter/episode URL and replace the number with{" "}
                <code className="font-mono">{"{n}"}</code>. You'll get a “
                {isWatchKind(series.kind) ? "Watch next" : "Read next"}” button.
              </>
            }
          >
            <BlurField
              value={series.readUrlTemplate ?? ""}
              onCommit={(v) => void save({ readUrlTemplate: v.trim() || null })}
              placeholder="https://example.com/series/chapter-{n}"
              inputMode="url"
              className="h-10 w-full rounded-xl border bg-card px-3 font-mono text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
            />
            {series.readUrlTemplate && !nextUrl && (
              <p className="text-xs text-destructive">That doesn't look like an http(s) link.</p>
            )}
          </Field>
        </section>

        {/* History */}
        <section className="mt-10">
          <h2 className="mb-3 text-[0.7rem] font-medium tracking-widest text-muted-foreground uppercase">
            History
          </h2>
          {history && history.length > 0 ? (
            <ol className="relative ml-1.5 space-y-3 border-l pl-5">
              {history.map((h, i) => {
                const label =
                  h.season !== undefined && h.season > 0
                    ? `S${h.season} · E${formatChapter(h.chapter)}`
                    : `${progressLabel(series.kind) === "Episode" ? "Ep." : "Ch."} ${formatChapter(h.chapter)}`;
                return (
                  <li key={h._id} className="relative text-sm">
                    <span
                      className={cn(
                        "absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-background",
                        i === 0 ? "bg-hanko" : "bg-border",
                      )}
                    />
                    <span className="font-mono font-medium tabular-nums">{label}</span>
                    <span className="ml-2 text-muted-foreground" title={fullDate(h.at)}>
                      {relativeTime(h.at)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Changes will show up here.</p>
          )}
        </section>

        <div className="mt-12 border-t pt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 /> Remove from library
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {series.title}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Its history goes too. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    await navigate({ to: "/library" });
                    await remove({ id: series._id });
                    toast(`Removed ${series.title}`);
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </fieldset>
    </div>
  );
}

// Combobox values are plain strings; these came from label ids (or a label just created).
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const asLabelIds = (ids: string[]) => ids as Id<"labels">[];

function ManageLabelsDialog({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const labels = useQuery(api.labels.list) ?? [];
  const createLabel = useMutation(api.labels.create);
  const renameLabel = useMutation(api.labels.rename);
  const removeLabel = useMutation(api.labels.remove);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<Id<"labels"> | null>(null);
  const [editName, setEditName] = useState("");

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await createLabel({ name: trimmed });
      setNewName("");
      toast.success(`Created label “${trimmed}”`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create label.");
    }
  }

  async function handleRename(id: Id<"labels">) {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await renameLabel({ id, name: trimmed });
      setEditingId(null);
      toast.success("Renamed label");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't rename label.");
    }
  }

  async function handleRemove(id: Id<"labels">, name: string) {
    try {
      await removeLabel({ id });
      toast.success(`Deleted label “${name}”`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete label.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          <Settings2 className="size-3" /> Manage labels
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Manage labels</DialogTitle>
          <DialogDescription>Create, rename, or delete your custom labels.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="New label name…"
            className="rounded-xl text-sm"
          />
          <Button type="button" onClick={() => void handleCreate()} className="rounded-xl">
            Add
          </Button>
        </div>

        <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
          {labels.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No labels yet.</p>
          ) : (
            labels.map((l) => (
              <div
                key={l._id}
                className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm"
              >
                {editingId === l._id ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleRename(l._id);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      className="h-8 rounded-lg text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleRename(l._id)}
                      className="h-8 rounded-lg"
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <span className="font-medium text-foreground">{l.name}</span>
                )}
                <div className="flex items-center gap-1">
                  {editingId !== l._id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(l._id);
                        setEditName(l.name);
                      }}
                      className="p-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Rename"
                      aria-label="Rename label"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRemove(l._id, l.name)}
                    className="p-1 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                    aria-label="Delete label"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Single-line input that saves when you leave it (or press Enter), and follows remote changes otherwise. */
function BlurField({
  value,
  onCommit,
  ...props
}: { value: string; onCommit: (value: string) => void | false } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        // Returning false rejects the edit and restores the saved value.
        if (draft !== value && onCommit(draft) === false) setDraft(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          requestAnimationFrame(() => e.currentTarget?.blur());
        }
      }}
    />
  );
}

function BlurTextarea({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  // `draft` is the trigger: resize to fit whenever the text changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [draft]);
  return (
    <textarea
      ref={ref}
      value={draft}
      rows={3}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        if (draft !== value) onCommit(draft);
      }}
      className="min-h-24 w-full resize-none overflow-hidden rounded-xl border bg-card px-3 py-2.5 text-[0.95rem] leading-relaxed outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
    />
  );
}

function ChapterInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  return (
    <BlurField
      id={id}
      value={formatChapter(value)}
      inputMode="decimal"
      onCommit={(v) => {
        const n = Number(v);
        if (v.trim() && Number.isFinite(n) && n >= 0) return onCommit(n);
        toast.error("Enter a number, like 12 or 12.5");
        return false;
      }}
      style={{ width: `${Math.max(2, formatChapter(value).length) + 0.5}ch` }}
      className="bg-transparent font-mono text-5xl sm:text-6xl leading-none font-semibold tabular-nums outline-none"
    />
  );
}
