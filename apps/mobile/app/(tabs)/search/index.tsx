import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../../../src/theme";
import { useTabBarInset } from "../../../src/components/glass";
import { NoteCard } from "../../../src/notes/note-card";
import { SeriesCard } from "../../../src/library/series-card";

type Row = { kind: "note"; note: Doc<"notes"> } | { kind: "series"; series: Doc<"series"> };

/** One search across notes and the Library, like the web's search. */
export default function SearchScreen() {
  const { colors, radii, typography } = useTheme();
  const tabBarInset = useTabBarInset();
  const focused = useIsFocused();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Arriving here means you want to type.
  useEffect(() => {
    if (focused) inputRef.current?.focus();
  }, [focused]);

  const notes = useQuery(api.notes.search, debounced ? { query: debounced, limit: 20 } : "skip");
  const series = useQuery(api.library.search, debounced ? { query: debounced, limit: 20 } : "skip");
  const loading = !!query.trim() && (query.trim() !== debounced || !notes || !series);
  const terms = useMemo(() => debounced.split(/\s+/).filter(Boolean), [debounced]);

  const sections = [
    ...(series?.length
      ? [{ title: "Library", data: series.map((s): Row => ({ kind: "series", series: s })) }]
      : []),
    ...(notes?.length
      ? [{ title: "Notes", data: notes.map((n): Row => ({ kind: "note", note: n })) }]
      : []),
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.paper }]}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: radii.controls,
          },
        ]}
      >
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes and Library…"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search"
          style={[styles.input, typography.body, { color: colors.ink }]}
        />
        {loading && <ActivityIndicator size="small" color={colors.muted} />}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(row) => (row.kind === "note" ? row.note._id : row.series._id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset + 16 }]}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.section, { color: colors.muted }]}>{section.title}</Text>
        )}
        renderItem={({ item }) =>
          item.kind === "note" ? (
            <NoteCard note={item.note} terms={terms} query={debounced} />
          ) : (
            <SeriesCard series={item.series} />
          )
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.muted }]}>
            {!query.trim()
              ? "Find a note or a series by its title or words inside it."
              : loading
                ? ""
                : `Nothing matches “${query.trim()}”.`}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
  },
  input: { flex: 1, paddingVertical: 0 },
  list: { paddingHorizontal: 16, gap: 10 },
  section: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 2,
  },
  empty: { textAlign: "center", marginTop: 48, fontSize: 14, paddingHorizontal: 24 },
});
