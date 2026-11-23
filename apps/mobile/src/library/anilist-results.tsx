import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { haptics } from "../haptics";
import type { SeriesKind } from "@inkmark/backend/convex/validators";
import {
  type AniListMedia,
  AniListError,
  catalogFor,
  catalogName,
  describeMedia,
  displayTitle,
  errorMessage,
  searchCatalog,
} from "./anilist";
import { KIND_LABEL } from "./series";

export type AniListSearchState =
  | { status: "idle" }
  | { status: "loading"; results: AniListMedia[] }
  | { status: "done"; results: AniListMedia[] }
  | { status: "error"; message: string; results: AniListMedia[] };

/**
 * Debounced search-as-you-type in the catalog for `kind` (AniList or TVmaze), like the web.
 * Keeps the last results visible while the next request runs.
 */
export function useAniListSearch(
  query: string,
  kind: SeriesKind,
  enabled = true,
): AniListSearchState {
  const q = query.trim();
  const source = catalogFor(kind);
  const [fetched, setFetched] = useState<{
    q: string;
    results: AniListMedia[];
    error?: string;
  } | null>(null);
  const idle = !enabled || q.length < 2;
  // Results are per catalog and type: anime and manga searches differ for the same words.
  const key = `${source}:${kind}:${q}`;

  useEffect(() => {
    if (idle) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalog(q, kind, controller.signal).then(
        (results) => setFetched({ q: key, results }),
        (err: unknown) => {
          if (controller.signal.aborted) return;
          if (!(err instanceof AniListError)) console.error(err);
          setFetched((f) => ({
            q: key,
            results: f?.results ?? [],
            error: errorMessage(err, source),
          }));
        },
      );
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, key, kind, source, idle]);

  if (idle) return { status: "idle" };
  const results = fetched?.results ?? [];
  if (fetched?.q !== key) return { status: "loading", results };
  if (fetched.error !== undefined) return { status: "error", message: fetched.error, results };
  return { status: "done", results };
}

/**
 * The list of matches. Rendered as plain Views, not a FlatList, so it can sit inside a ScrollView.
 * At most 8 rows come back from AniList.
 */
export function AniListResults({
  kind,
  state,
  selectedId,
  onPick,
}: {
  kind: SeriesKind;
  state: AniListSearchState;
  selectedId?: number;
  onPick: (media: AniListMedia) => void;
}) {
  const { colors, radii } = useTheme();
  const name = catalogName(catalogFor(kind));
  if (state.status === "idle") return null;
  const results = state.results;

  return (
    <View style={styles.wrap}>
      {results.length > 0 ? (
        <View
          accessibilityLabel={`${name} matches`}
          style={[
            styles.list,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radii.controls,
            },
          ]}
        >
          {results.map((media, i) => {
            const title = displayTitle(media);
            const original = media.title.native ?? media.title.romaji;
            const selected = media.id === selectedId;
            return (
              <Pressable
                key={media.id}
                accessibilityRole="button"
                accessibilityLabel={`Use ${title} from ${name}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  haptics.tap();
                  onPick(media);
                }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                  pressed && { backgroundColor: colors.surfaceHighlight },
                ]}
              >
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
                    {title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>
                    {original && original !== title ? `${original} · ` : ""}
                    {describeMedia(media, (k) => KIND_LABEL[k])}
                  </Text>
                </View>
                {selected ? <Feather name="check" size={16} color={colors.hanko} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.status} accessibilityLiveRegion="polite">
        {state.status === "loading" ? (
          <>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={[styles.statusText, { color: colors.muted }]}>Searching {name}…</Text>
          </>
        ) : state.status === "error" ? (
          <Text style={[styles.statusText, { color: colors.destructive }]}>{state.message}</Text>
        ) : (
          <Text style={[styles.statusText, { color: colors.muted }]}>
            {results.length === 0
              ? `No ${name} match. You can still add it by hand.`
              : `Pick one to fill in the details from ${name}.`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  list: { borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 18,
    paddingHorizontal: 2,
  },
  statusText: { fontSize: 12 },
});
