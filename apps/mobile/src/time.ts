type Unit = "minute" | "hour" | "day";

/**
 * Hermes (the JS engine on Android) has no Intl.RelativeTimeFormat, and
 * constructing one there throws, which crashed the app on load. Use it where
 * it exists, otherwise fall back to plain English.
 */
function createRelativeFormat(): (value: number, unit: Unit) => string {
  if (typeof Intl !== "undefined" && typeof Intl.RelativeTimeFormat === "function") {
    try {
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
      return (value, unit) => rtf.format(value, unit);
    } catch {
      // Fall through to the plain version.
    }
  }
  return fallbackRelative;
}

export function fallbackRelative(value: number, unit: Unit): string {
  if (unit === "day" && value === -1) return "yesterday";
  if (unit === "day" && value === 1) return "tomorrow";
  const n = Math.abs(value);
  const label = `${n} ${unit}${n === 1 ? "" : "s"}`;
  return value < 0 ? `${label} ago` : `in ${label}`;
}

const relative = createRelativeFormat();
const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return relative(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return relative(days, "day");
  const date = new Date(ms);
  return date.getFullYear() === new Date(now).getFullYear()
    ? dateFmt.format(date)
    : fullFmt.format(date);
}

export function fullDate(ms: number): string {
  return fullFmt.format(new Date(ms));
}
