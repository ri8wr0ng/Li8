import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Dices } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAiPanel } from "#/components/ask/ai-panel";
import { UsageView } from "#/components/ask/usage-view";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import {
  AVATAR_STYLES,
  AVATAR_STYLE_KEYS,
  DEFAULT_AVATAR_STYLE,
  UserAvatar,
  avatarUri,
  isAvatarStyle,
  type AvatarStyle,
} from "#/components/user-avatar";
import { useCachedQuery, useReadOnly } from "#/lib/offline";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  formatChapter,
  isSeriesKind,
  progressLabel,
} from "#/lib/series";
import { cn } from "#/lib/utils";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { SeriesStatus } from "@inkmark/backend/convex/validators";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

const number = (n: number) => new Intl.NumberFormat().format(n);

function ProfilePage() {
  const me = useCachedQuery(api.users.me, "me");
  const [tzOffsetMinutes] = useState(() => new Date().getTimezoneOffset());
  const stats = useQuery(api.users.stats, { tzOffsetMinutes });
  const ai = useAiPanel();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <Identity me={me} />

      <section aria-labelledby="totals" className="mt-10">
        <h2 id="totals" className="sr-only">
          Totals
        </h2>
        {stats ? <Totals stats={stats} /> : <Skeleton className="h-20 rounded-2xl" />}
      </section>

      <section aria-labelledby="activity" className="mt-10">
        <h2 id="activity" className="font-display text-lg font-semibold tracking-[-0.01em]">
          Reading log
        </h2>
        {stats ? (
          <ActivityGrid activity={stats.activity} />
        ) : (
          <Skeleton className="mt-3 h-36 rounded-2xl" />
        )}
      </section>

      {stats && stats.series > 0 && (
        <section aria-labelledby="library" className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 id="library" className="font-display text-lg font-semibold tracking-[-0.01em]">
              Library
            </h2>
            <StatusBar byStatus={stats.byStatus} total={stats.series} />
          </div>
          {stats.current.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">In progress</h2>
              <ul className="mt-3 divide-y rounded-2xl border bg-card">
                {stats.current.map((s) => (
                  <li key={s.id}>
                    <Link
                      to="/library/$seriesId"
                      params={{ seriesId: s.id }}
                      className="flex items-baseline justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">{s.title}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        {isSeriesKind(s.kind) && progressLabel(s.kind) === "Episode" ? "Ep" : "Ch"}{" "}
                        {formatChapter(s.chapter)}
                        {s.totalChapters ? ` / ${formatChapter(s.totalChapters)}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {ai.available && (
        <section id="ai-usage" aria-labelledby="ai-usage-title" className="mt-12 scroll-mt-20">
          <h2 id="ai-usage-title" className="font-display text-lg font-semibold tracking-[-0.01em]">
            AI usage
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What Ask and search by meaning have cost, and how much of your limit is left.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
            <UsageView />
          </div>
        </section>
      )}
    </div>
  );
}

type Me = NonNullable<ReturnType<typeof useCachedQuery<typeof api.users.me>>>;

function Identity({ me }: { me: Me | null | undefined }) {
  const update = useMutation(api.users.updateProfile);
  const readOnly = useReadOnly();
  const style: AvatarStyle = isAvatarStyle(me?.avatarStyle) ? me.avatarStyle : DEFAULT_AVATAR_STYLE;
  const seed = me ? (me.avatarSeed ?? me.id) : "";

  const save = (patch: Parameters<typeof update>[0], done?: string) =>
    update(patch)
      .then(() => done && toast(done))
      .catch((err: unknown) => {
        console.error(err);
        toast.error("Couldn't save your profile. Try again.");
      });

  // Previews of every style, drawn with the current seed.
  const previews = useMemo(
    () =>
      seed
        ? AVATAR_STYLE_KEYS.map((key) => ({
            key,
            src: avatarUri(key, seed),
          }))
        : [],
    [seed],
  );

  const joined = me
    ? new Date(me.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <UserAvatar user={me} className="size-24 text-3xl ring-4 ring-card sm:size-28" />

      <div className="min-w-0 flex-1">
        {me ? (
          <NameField
            key={me.name ?? ""}
            name={me.name ?? ""}
            disabled={readOnly}
            onCommit={(name) => void save({ name }, "Name saved")}
          />
        ) : (
          <Skeleton className="h-9 w-48" />
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {me?.email}
          {joined && (
            <>
              <br />
              Using li8 since {joined}
            </>
          )}
        </p>

        <fieldset disabled={readOnly || !me} className="mt-5">
          <legend className="text-sm font-medium">Avatar</legend>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {previews.map(({ key, src }) => (
              <button
                key={key}
                type="button"
                aria-pressed={style === key}
                aria-label={AVATAR_STYLES[key].label}
                title={AVATAR_STYLES[key].label}
                onClick={() => void save({ avatarStyle: key })}
                className={cn(
                  "size-11 overflow-hidden rounded-full bg-secondary outline-none transition-[box-shadow,transform] duration-150 ease-out active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  style === key
                    ? "ring-2 ring-hanko ring-offset-2 ring-offset-background"
                    : "opacity-80 hover:opacity-100",
                )}
              >
                <img src={src} alt="" className="size-full" draggable={false} />
              </button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 rounded-full"
              onClick={() => void save({ avatarSeed: crypto.randomUUID() })}
            >
              <Dices /> Shuffle
            </Button>
          </div>
        </fieldset>
      </div>
    </header>
  );
}

function NameField({
  name,
  disabled,
  onCommit,
}: {
  name: string;
  disabled: boolean;
  onCommit: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <input
      aria-label="Your name"
      value={value}
      disabled={disabled}
      maxLength={80}
      placeholder="Add your name"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValue(name);
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const next = value.trim();
        if (!next) setValue(name);
        else if (next !== name) onCommit(next);
      }}
      className="-mx-2 w-full rounded-lg bg-transparent px-2 py-0.5 font-display text-3xl font-semibold tracking-[-0.02em] outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 sm:text-4xl"
    />
  );
}

type Stats = NonNullable<ReturnType<typeof useQuery<typeof api.users.stats>>>;

function Totals({ stats }: { stats: Stats }) {
  const plus = stats.capped ? "+" : "";
  const items = [
    { value: `${number(stats.notes)}${plus}`, label: stats.notes === 1 ? "note" : "notes" },
    { value: `${number(stats.series)}${plus}`, label: "in your library" },
    { value: number(stats.chapters), label: "chapters read" },
    { value: number(stats.episodes), label: "episodes watched" },
  ];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "px-4 py-4 sm:px-5",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t sm:border-t-0",
            i === 2 && "sm:border-l",
          )}
        >
          <dd className="font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums sm:text-3xl">
            {item.value}
          </dd>
          <dt className="mt-0.5 text-sm text-muted-foreground">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Twelve weeks of progress updates, one square per day, darker for busier days. */
function ActivityGrid({ activity }: { activity: number[] }) {
  const total = activity.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...activity);
  const activeDays = activity.filter((n) => n > 0).length;

  // Pad the front so each column is a Sunday-to-Saturday week.
  const [first] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (activity.length - 1));
    return d;
  });
  const pad = first.getDay();
  const cells: ({ count: number; date: Date } | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...activity.map((count, i) => {
      const date = new Date(first);
      date.setDate(first.getDate() + i);
      return { count, date };
    }),
  ];

  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const shades = ["bg-secondary", "bg-hanko/25", "bg-hanko/50", "bg-hanko/75", "bg-hanko"];

  return (
    <div className="mt-3 rounded-2xl border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "No chapters or episodes logged in the last 12 weeks. Bump a series and it shows up here."
          : `${number(total)} ${total === 1 ? "update" : "updates"} on ${activeDays} ${activeDays === 1 ? "day" : "days"} in the last 12 weeks.`}
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <div
          aria-hidden
          className="grid grid-rows-7 gap-1 pr-1 text-[0.65rem] text-muted-foreground"
        >
          {DAY_NAMES.map((d, i) => (
            <span key={d} className="flex h-3.5 items-center sm:h-4">
              {i % 2 === 1 ? d : ""}
            </span>
          ))}
        </div>
        <div
          role="img"
          aria-label={`Activity over the last 12 weeks: ${total} updates`}
          className="grid grid-flow-col grid-rows-7 gap-1"
        >
          {cells.map((cell, i) =>
            cell ? (
              <span
                key={i}
                title={`${cell.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${cell.count} ${cell.count === 1 ? "update" : "updates"}`}
                className={cn("size-3.5 rounded-[4px] sm:size-4", shades[level(cell.count)])}
              />
            ) : (
              <span key={i} className="size-3.5 sm:size-4" />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_SHADES: Record<SeriesStatus, string> = {
  reading: "bg-hanko",
  planned: "bg-foreground/45",
  on_hold: "bg-foreground/25",
  completed: "bg-foreground",
  dropped: "bg-foreground/10",
};

function StatusBar({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const rows = STATUS_ORDER.map((s) => ({ status: s, count: byStatus[s] ?? 0 })).filter(
    (r) => r.count > 0,
  );
  return (
    <div className="mt-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        {rows.map((r) => (
          <span
            key={r.status}
            className={STATUS_SHADES[r.status]}
            style={{ width: `${(r.count / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-2">
        {rows.map((r) => (
          <li key={r.status}>
            <Link
              to="/library"
              search={{ status: r.status }}
              className="flex items-center gap-2.5 text-sm hover:underline"
            >
              <span className={cn("size-2.5 rounded-full", STATUS_SHADES[r.status])} />
              <span className="flex-1">{STATUS_LABEL[r.status]}</span>
              <span className="tabular-nums text-muted-foreground">{number(r.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
