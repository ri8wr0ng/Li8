import MiniSearch from "minisearch";
import { useMemo } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import { acronym } from "./series";

type IndexedDoc = {
  id: string;
  type: "note" | "series";
  title: string;
  names: string;
  body: string;
  tags: string;
};

export type SearchHit =
  | { type: "note"; doc: Doc<"notes">; terms: string[]; score: number }
  | { type: "series"; doc: Doc<"series">; terms: string[]; score: number };

/**
 * One in-memory full-text index over notes and series: fuzzy (typos), prefix
 * ("batt" finds "battle") and alias-aware ("btth" finds the series even
 * without an alternative name, thanks to the generated acronym).
 */
export function useSearch(notes: Doc<"notes">[] | undefined, series: Doc<"series">[] | undefined) {
  return useMemo(() => {
    const index = new MiniSearch<IndexedDoc>({
      fields: ["title", "names", "body", "tags"],
      searchOptions: {
        boost: { title: 3, names: 3, tags: 1.5 },
        prefix: true,
        fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      },
    });
    const byId = new Map<string, Doc<"notes"> | Doc<"series">>();

    for (const note of notes ?? []) {
      byId.set(note._id, note);
      index.add({
        id: note._id,
        type: "note",
        title: note.title,
        names: "",
        body: note.body,
        tags: note.tags.join(" "),
      });
    }
    for (const s of series ?? []) {
      byId.set(s._id, s);
      const names = [...s.altNames, acronym(s.title), ...s.altNames.map(acronym)];
      index.add({
        id: s._id,
        type: "series",
        title: s.title,
        names: names.join(" "),
        body: s.description,
        tags: [...s.genres, s.kind].join(" "),
      });
    }

    /** `strict` requires every word to match (no OR fallback). */
    function search(query: string, filter?: "note" | "series", strict = false): SearchHit[] {
      const q = query.trim();
      if (!q) return [];
      const run = (combineWith: "AND" | "OR") =>
        index.search(q, {
          combineWith,
          filter: filter ? (r) => typeOf(r.id as string) === filter : undefined,
        });
      let results = run("AND");
      if (results.length === 0 && !strict) results = run("OR");
      return results.flatMap((r): SearchHit[] => {
        const doc = byId.get(r.id as string);
        if (!doc) return [];
        const hit = { terms: r.terms, score: r.score };
        return "chapter" in doc
          ? [{ ...hit, type: "series" as const, doc }]
          : [{ ...hit, type: "note" as const, doc }];
      });
    }

    function typeOf(id: string) {
      const doc = byId.get(id);
      return doc && "chapter" in doc ? "series" : "note";
    }

    return { search };
  }, [notes, series]);
}
