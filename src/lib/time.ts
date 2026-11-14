const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function relativeTime(ms: number, now = Date.now()) {
  const diff = ms - now;
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  const date = new Date(ms);
  return date.getFullYear() === new Date(now).getFullYear()
    ? dateFmt.format(date)
    : fullFmt.format(date);
}

export function fullDate(ms: number) {
  return fullFmt.format(new Date(ms));
}
