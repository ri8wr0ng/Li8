import { useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";

const RANGES = [7, 30, 90] as const;
type Measure = "cost" | "calls";

const KIND_LABELS: Record<string, string> = {
  chat: "Ask replies",
  index: "Indexing notes & series",
  search: "Searches by meaning",
};

const LIMIT_LABELS: Record<string, string> = {
  chat: "Chat messages",
  search: "Searches by meaning",
};

function usd(value: number) {
  if (value === 0) return "$0";
  if (value < 0.0001) return "<$0.0001";
  // Two significant digits, written out (no exponent).
  if (value < 0.01) return `$${value.toFixed(1 - Math.floor(Math.log10(value)))}`;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

const count = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: value >= 100_000 ? "compact" : "standard" }).format(
    value,
  );
const dayLabel = (ms: number, long = false) =>
  new Date(ms).toLocaleDateString(
    undefined,
    long
      ? { weekday: "short", month: "short", day: "numeric" }
      : { month: "short", day: "numeric" },
  );

/** Ticks once a second while mounted, so limit refills count up live. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function UsageView() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [measure, setMeasure] = useState<Measure>("cost");
  // Read once: the client's zone decides which day a call falls on.
  const [tzOffsetMinutes] = useState(() => new Date().getTimezoneOffset());
  const data = useQuery(api.usage.summary, { days, tzOffsetMinutes });

  if (data === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin" /> Loading usage…
      </div>
    );
  }
  if (data === null) return null;

  const kinds = Object.entries(data.byKind).toSorted(
    (a, b) => b[1].cost - a[1].cost || b[1].calls - a[1].calls,
  );
  const models = Object.entries(data.byModel).toSorted(
    (a, b) => b[1].cost - a[1].cost || b[1].calls - a[1].calls,
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {/* Filters: one row, above everything they affect. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Range"
            value={days}
            options={RANGES.map((d) => ({ value: d, label: `${d} days` }))}
            onChange={setDays}
          />
          <Segmented
            label="Chart shows"
            value={measure}
            options={[
              { value: "cost", label: "Cost" },
              { value: "calls", label: "Calls" },
            ]}
            onChange={setMeasure}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Today"
            value={usd(data.today.cost)}
            detail={`${count(data.today.calls)} calls`}
          />
          <Stat
            label={`Last ${data.days} days`}
            value={usd(data.total.cost)}
            detail={`${count(data.total.calls)} calls`}
          />
          <Stat
            label="Tokens in"
            value={count(data.total.inputTokens)}
            detail={`last ${data.days} days`}
          />
          <Stat
            label="Tokens out"
            value={count(data.total.outputTokens)}
            detail={`last ${data.days} days`}
          />
        </div>

        <section
          aria-labelledby="usage-chart-title"
          className="rounded-2xl border bg-background p-4 sm:p-5"
        >
          <h3 id="usage-chart-title" className="text-sm font-semibold">
            {measure === "cost" ? "Cost per day" : "AI calls per day"}
          </h3>
          <DailyBars daily={data.daily} measure={measure} />
        </section>

        <section
          aria-labelledby="usage-limits-title"
          className="rounded-2xl border bg-background p-4 sm:p-5"
        >
          <h3 id="usage-limits-title" className="text-sm font-semibold">
            Available right now
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Limits refill continuously, so bursts recover on their own.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {data.limits.map((limit) => (
              <LimitMeter key={limit.name} {...limit} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="usage-breakdown-title"
          className="rounded-2xl border bg-background p-4 sm:p-5"
        >
          <h3 id="usage-breakdown-title" className="text-sm font-semibold">
            Breakdown
          </h3>
          {data.total.calls === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No AI calls in this range yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <BreakdownTable
                title="What for"
                rows={kinds.map(([k, b]) => [KIND_LABELS[k] ?? k, b])}
              />
              <BreakdownTable
                title="Model"
                rows={models.map(([m, b]) => [m, b])}
                mono
                className="mt-5"
              />
            </div>
          )}
          {(data.estimated || data.truncated) && (
            <p className="mt-4 text-xs text-muted-foreground">
              {data.estimated &&
                "Some costs weren't reported by the provider and are estimated from list prices. "}
              {data.truncated && "Only the most recent calls in this range are counted."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-xl border bg-background p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            value === o.value && "bg-secondary text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-[-0.02em]">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

type Day = { day: number; calls: number; inputTokens: number; outputTokens: number; cost: number };

/** One series, so no legend: the title names it. Hover or focus a day for its numbers. */
function DailyBars({ daily, measure }: { daily: Day[]; measure: Measure }) {
  const [active, setActive] = useState<number | null>(null);
  const values = daily.map((d) => (measure === "cost" ? d.cost : d.calls));
  const max = Math.max(...values, 0);
  const fmt = measure === "cost" ? usd : count;
  const hovered = active !== null ? daily[active] : undefined;
  const mid = Math.floor((daily.length - 1) / 2);

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {/* Recessive y-axis: just the top value. */}
        <div className="flex h-40 w-12 shrink-0 flex-col justify-between text-right text-[0.7rem] tabular-nums text-muted-foreground">
          <span>{max > 0 ? fmt(max) : ""}</span>
          <span>0</span>
        </div>
        <div className="relative h-40 min-w-0 flex-1" onMouseLeave={() => setActive(null)}>
          <div
            className="absolute inset-x-0 top-0 border-t border-dashed border-border/70"
            aria-hidden
          />
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-border">
            {daily.map((d, i) => {
              const value = values[i];
              const pct = max > 0 ? (value / max) * 100 : 0;
              return (
                <button
                  key={d.day}
                  type="button"
                  aria-label={`${dayLabel(d.day, true)}: ${fmt(value)}${measure === "cost" ? `, ${d.calls} calls` : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="group flex h-full min-w-0 flex-1 items-end outline-none"
                >
                  <span
                    className={cn(
                      "block w-full rounded-t-[4px] bg-primary transition-opacity",
                      active !== null && active !== i && "opacity-40",
                      "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    )}
                    style={{ height: value > 0 ? `max(${pct}%, 2px)` : 0 }}
                  />
                </button>
              );
            })}
          </div>
          {hovered && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${((active + 0.5) / daily.length) * 100}%` }}
            >
              <div className="font-medium">{dayLabel(hovered.day, true)}</div>
              <div className="tabular-nums text-muted-foreground">
                {usd(hovered.cost)} · {count(hovered.calls)} calls
              </div>
              <div className="tabular-nums text-muted-foreground">
                {count(hovered.inputTokens)} in · {count(hovered.outputTokens)} out
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-14 text-[0.7rem] text-muted-foreground">
        <span>{dayLabel(daily[0].day)}</span>
        {daily.length > 2 && <span>{dayLabel(daily[mid].day)}</span>}
        <span>Today</span>
      </div>
    </div>
  );
}

function LimitMeter({
  name,
  value,
  ts,
  rate,
  period,
  capacity,
}: {
  name: string;
  value: number;
  ts: number;
  rate: number;
  period: number;
  capacity: number;
}) {
  const now = useNow();
  // Token bucket: refills at rate/period, up to capacity.
  const available = Math.max(0, Math.min(capacity, value + ((now - ts) * rate) / period));
  const whole = Math.floor(available);
  const perMinute = (rate / period) * 60_000;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{LIMIT_LABELS[name] ?? name}</span>
        <span className="tabular-nums text-muted-foreground">
          {whole} of {capacity}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${LIMIT_LABELS[name] ?? name} available`}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={whole}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(available / capacity) * 100}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Refills{" "}
        {perMinute >= 1
          ? `${Math.round(perMinute * 10) / 10} a minute`
          : `one every ${Math.round(1 / perMinute)} minutes`}
      </div>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  mono,
  className,
}: {
  title: string;
  rows: [string, { calls: number; inputTokens: number; outputTokens: number; cost: number }][];
  mono?: boolean;
  className?: string;
}) {
  return (
    <table className={cn("w-full min-w-[32rem] text-sm", className)}>
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-2 pr-3 font-medium">{title}</th>
          <th className="py-2 pr-3 text-right font-medium">Calls</th>
          <th className="py-2 pr-3 text-right font-medium">Tokens in</th>
          <th className="py-2 pr-3 text-right font-medium">Tokens out</th>
          <th className="py-2 text-right font-medium">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, b]) => (
          <tr key={name} className="border-b last:border-0">
            <td className={cn("py-2 pr-3", mono && "font-mono text-xs")}>{name}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{count(b.calls)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{count(b.inputTokens)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{count(b.outputTokens)}</td>
            <td className="py-2 text-right tabular-nums">{usd(b.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
