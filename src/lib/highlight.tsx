import type { ReactNode } from "react";

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A case-insensitive regex matching any of the terms, longest first. */
export function termsRegex(terms: string[]) {
  const parts = [...new Set(terms.map((t) => t.trim()).filter(Boolean))]
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp);
  return parts.length ? new RegExp(`(${parts.join("|")})`, "giu") : null;
}

/** Wrap every occurrence of the terms in <mark>. */
export function Highlight({ text, terms }: { text: string; terms: string[] }): ReactNode {
  const regex = termsRegex(terms);
  if (!regex) return text;
  const parts = text.split(regex);
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

/** A short excerpt around the first matching term, so hits deep in a note are visible. */
export function snippet(text: string, terms: string[], radius = 70) {
  const flat = text.replace(/\s+/g, " ").trim();
  const regex = termsRegex(terms);
  const match = regex ? regex.exec(flat) : null;
  if (!match) return flat.slice(0, radius * 2);
  const start = Math.max(0, match.index - radius);
  const end = Math.min(flat.length, match.index + match[0].length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

/** Start offsets of every case-insensitive occurrence of `needle` in `text`. */
export function findAll(text: string, needle: string) {
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
