import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../../../src/theme";
import { useTabBarInset } from "../../../src/components/glass";
import { NoteCard } from "../../../src/notes/note-card";
import { SeriesCard } from "../../../src/library/series-card";
import { findSeries, formatChapter, parseChapterCommand } from "../../../src/library/series";
import { haptics } from "../../../src/haptics";

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

  // "btth 349" sets the chapter, "btth +10" moves it, like the web's search.
  const parsed = useMemo(() => parseChapterCommand(debounced), [debounced]);
  const seriesQuery = parsed?.name ?? debounced;
  const notes = useQuery(api.notes.search, debounced ? { query: debounced, limit: 20 } : "skip");
  const series = useQuery(
    api.library.search,
    seriesQuery ? { query: seriesQuery, limit: 20 } : "skip",
  );
  const loading = !!query.trim() && (query.trim() !== debounced || !notes || !series);
  const command = useMemo(() => {
    if (!parsed || !series || query.trim() !== debounced) return null;
    const target = findSeries(parsed.name, series);
    return target ? { ...parsed, target } : null;
  }, [parsed, series, query, debounced]);

  const setChapter = useMutation(api.series.setChapter);
  const bump = useMutation(api.series.bump);
  const [done, setDone] = useState<{
    id: Doc<"series">["_id"];
    title: string;
    chapter: number;
    previous: number;
  } | null>(null);

  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => setDone(null), 6000);
    return () => clearTimeout(timer);
  }, [done]);

  const applyCommand = async () => {
    if (!command) return;
    const { target } = command;
    haptics.success();
    setQuery("");
    setDebounced("");
    try {
      let chapter: number;
      if (command.delta !== undefined) {
        chapter = await bump({ id: target._id, delta: command.delta });
      } else {
        chapter = command.chapter;
        await setChapter({ id: target._id, chapter });
      }
      setDone({ id: target._id, title: target.title, chapter, previous: target.chapter });
    } catch (err) {
      console.error("Chapter command error:", err);
      haptics.warning();
    }
  };

  const undo = () => {
    if (!done) return;
    haptics.tap();
    void setChapter({ id: done.id, chapter: done.previous });
    setDone(null);
  };
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
          placeholder="Search, or type “btth 349” or “btth +10”"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search"
          style={[styles.input, typography.body, { color: colors.ink }]}
        />
        {loading && <ActivityIndicator size="small" color={colors.muted} />}
      </View>

      {command && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            command.delta !== undefined
              ? `${command.delta > 0 ? "Add" : "Remove"} ${Math.abs(command.delta)} on ${command.target.title}`
              : `Set ${command.target.title} to chapter ${formatChapter(command.chapter)}`
          }
          onPress={() => void applyCommand()}
          style={({ pressed }) => [
            styles.command,
            {
              backgroundColor: colors.card,
              borderColor: colors.hanko,
              borderRadius: radii.controls,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="bookmark" size={18} color={colors.hanko} />
          <Text style={[styles.commandText, { color: colors.ink }]} numberOfLines={1}>
            {command.delta !== undefined ? (
              <>
                {command.delta > 0 ? "+" : ""}
                {command.delta} on <Text style={styles.bold}>{command.target.title}</Text>
              </>
            ) : (
              <>
                Set <Text style={styles.bold}>{command.target.title}</Text> to Ch.{" "}
                {formatChapter(command.chapter)}
              </>
            )}
          </Text>
          <Text style={[styles.commandNow, typography.number, { color: colors.muted }]}>
            now {formatChapter(command.target.chapter)}
          </Text>
        </Pressable>
      )}

      {done && !command && (
        <View
          style={[
            styles.command,
            {
              backgroundColor: colors.surfaceHighlight,
              borderColor: colors.border,
              borderRadius: radii.controls,
            },
          ]}
        >
          <Feather name="check" size={18} color={colors.hanko} />
          <Text style={[styles.commandText, { color: colors.ink }]} numberOfLines={1}>
            {done.title} → Ch. {formatChapter(done.chapter)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            onPress={undo}
            hitSlop={8}
          >
            <Text style={[styles.undo, { color: colors.hanko }]}>Undo</Text>
          </Pressable>
        </View>
      )}

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
  command: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  commandText: { flex: 1, fontSize: 14 },
  commandNow: { fontSize: 12 },
  bold: { fontWeight: "600" },
  undo: { fontSize: 14, fontWeight: "600" },
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
