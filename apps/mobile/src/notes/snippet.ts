function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A case-insensitive regex matching any of the terms, longest first. */
export function termsRegex(terms: string[]): RegExp | null {
  // Hermes (Android's JS engine) has no Array.prototype.toSorted; calling it crashed
  // every note card. Spreading the Set already makes a fresh array, so sort it in place.
  const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  // oxlint-disable-next-line unicorn/no-array-sort
  const parts = unique.sort((a, b) => b.length - a.length).map(escapeRegExp);
  return parts.length ? new RegExp(`(${parts.join("|")})`, "giu") : null;
}

/** A short excerpt around the first matching term, so hits deep in a note are visible. */
export function snippet(text: string, terms: string[], radius = 70): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const regex = termsRegex(terms);
  const match = regex ? regex.exec(flat) : null;
  if (!match) return flat.slice(0, radius * 2);
  const start = Math.max(0, match.index - radius);
  const end = Math.min(flat.length, match.index + match[0].length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

/** Start offsets of every case-insensitive occurrence of `needle` in `text`. */
export function findAll(text: string, needle: string): number[] {
  const out: number[] = [];
  const q = needle.toLocaleLowerCase();
  if (!q) return out;
  const hay = text.toLocaleLowerCase();
  let i = hay.indexOf(q);
  while (i !== -1) {
    out.push(i);
    i = hay.indexOf(q, i + q.length);
  }
  return out;
}
