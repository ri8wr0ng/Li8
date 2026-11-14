import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, BookX, ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
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
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { KIND_LABEL, KIND_ORDER, STATUS_LABEL, STATUS_ORDER, formatChapter, readUrl } from "#/lib/series";
import { useCachedQuery, useOnline, useReadOnly } from "#/lib/offline";
import { fullDate, relativeTime } from "#/lib/time";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { SeriesKind, SeriesStatus } from "../../../convex/validators";

export const Route = createFileRoute("/_app/library/$seriesId")({
  component: SeriesPage,
  errorComponent: Missing,
});

function SeriesPage() {
  const { seriesId } = Route.useParams();
  const { isAuthenticated } = useConvexAuth();
  const online = useOnline();
  const live = useQuery(api.series.get, isAuthenticated ? { id: seriesId as Id<"series"> } : "skip");
  // Until the live copy arrives (or with no connection), show the saved one.
  const list = useCachedQuery(api.series.list, "series");
  const cached = list?.find((s) => s._id === seriesId);
  const series = live !== undefined ? live : (cached ?? (list && !online ? null : undefined));
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
  const bump = useMutation(api.series.bump);
  const remove = useMutation(api.series.remove);
  const history = useQuery(api.series.history, { seriesId: series._id });
  const navigate = useNavigate();
  const readOnly = useReadOnly();

  const save = (patch: Omit<Parameters<typeof update>[0], "id">) =>
    update({ id: series._id, ...patch }).catch((err: unknown) => {
      console.error(err);
      toast.error("Couldn't save. Please try again.");
    });

  const nextUrl = readUrl(series.readUrlTemplate, series.chapter + 1);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
      <div className="flex h-14 items-center">
        <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
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
              series.altNames.length ? "Add another name" : "Add alternative names (BTTH, 斗破苍穹…)"
            }
          />
        </div>

        {/* Chapter */}
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
                      void save({ totalChapters: v.trim() && Number.isFinite(n) && n > 0 ? n : null });
                    }}
                    className="w-20 bg-transparent font-mono tabular-nums outline-none placeholder:text-muted-foreground/60"
                  />
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Updated {relativeTime(series.lastReadAt)}</p>
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
                style={{ width: `${Math.min(100, (series.chapter / series.totalChapters) * 100)}%` }}
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

        {/* Details */}
        <section className="mt-8 grid gap-6">
          <AniListControls series={series} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={series.kind} onValueChange={(kind) => void save({ kind: kind as SeriesKind })}>
                <SelectTrigger className="w-full rounded-xl">
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
            </Field>
            <Field label="Status">
              <Select
                value={series.status}
                onValueChange={(status) => void save({ status: status as SeriesStatus })}
              >
                <SelectTrigger className="w-full rounded-xl">
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
            label="Reading link"
            hint={
              <>
                Paste a chapter URL and replace the number with <code className="font-mono">{"{n}"}</code>.
                You'll get a “Read next” button.
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
              {history.map((h, i) => (
                <li key={h._id} className="relative text-sm">
                  <span
                    className={cn(
                      "absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-background",
                      i === 0 ? "bg-hanko" : "bg-border",
                    )}
                  />
                  <span className="font-mono font-medium tabular-nums">Ch. {formatChapter(h.chapter)}</span>
                  <span className="ml-2 text-muted-foreground" title={fullDate(h.at)}>
                    {relativeTime(h.at)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Chapter changes will show up here.</p>
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
                  Its chapter history goes too. This can't be undone.
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
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
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

function ChapterInput({ id, value, onCommit }: { id: string; value: number; onCommit: (n: number) => void }) {
  return (
    <BlurField
      id={id}
      value={formatChapter(value)}
      inputMode="decimal"
      onCommit={(v) => {
        const n = Number(v);
        if (v.trim() && Number.isFinite(n) && n >= 0) return onCommit(n);
        toast.error("Enter a chapter number, like 348 or 348.5");
        return false;
      }}
      style={{ width: `${Math.max(2, formatChapter(value).length) + 0.5}ch` }}
      className="bg-transparent font-mono text-6xl leading-none font-semibold tabular-nums outline-none"
    />
  );
}
