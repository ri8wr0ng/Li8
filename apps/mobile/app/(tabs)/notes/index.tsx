import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useCachedPaginatedQuery, useCachedQuery } from "../../../src/offline";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../../../src/theme";
import { HeaderActions, HeaderIconButton } from "../../../src/components/profile-button";
import { BottomSearchBar, useBottomSearchInset } from "../../../src/components/bottom-search-bar";
import { useScreenSearch } from "../../../src/components/screen-search";
import { EmptyState } from "../../../src/notes/empty-state";
import { NoteCard } from "../../../src/notes/note-card";

type ListItem =
  | { type: "header"; id: string; title: string }
  | {
      type: "note";
      id: string;
      note: Doc<"notes">;
      terms: string[];
      subtitle?: string;
    };

export default function NotesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, radii, typography } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<"all" | "shared" | "archived">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const clearQuery = useCallback(() => setSearchQuery(""), []);
  const { visible: searchVisible, close: closeSearch } = useScreenSearch("notes", clearQuery);
  const bottomInset = useBottomSearchInset(0, searchVisible);

  const createNote = useMutation(api.notes.create);

  const handleCreateNote = useCallback(async () => {
    if (isCreating) return;
    try {
      setIsCreating(true);
      const noteId = await createNote({});
      router.push({
        pathname: "/(tabs)/notes/[noteId]",
        params: { noteId },
      });
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setIsCreating(false);
    }
  }, [createNote, isCreating, router]);

  // iOS: "New note" in the header. Android has it in the bottom bar.
  /* oxlint-disable react/no-unstable-nested-components */
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    navigation.setOptions({
      headerRight: () => (
        <HeaderActions>
          <HeaderIconButton
            icon="edit-3"
            label="New note"
            onPress={handleCreateNote}
            busy={isCreating}
          />
        </HeaderActions>
      ),
    });
  }, [navigation, handleCreateNote, isCreating]);
  /* oxlint-enable react/no-unstable-nested-components */

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  // Search query
  const searchResults = useQuery(
    api.notes.search,
    debouncedQuery && view !== "shared" ? { query: debouncedQuery, limit: 50 } : "skip",
  );

  // Paginated lists
  const pinnedQuery = useCachedPaginatedQuery(
    api.notes.listPage,
    { pinned: true },
    { initialNumItems: 50 },
  );
  const restQuery = useCachedPaginatedQuery(
    api.notes.listPage,
    { pinned: false },
    { initialNumItems: 50 },
  );

  const shared = useCachedQuery(api.notes.sharedWithMe, view === "shared" ? {} : "skip");

  // Search stays inside the chosen tab: Notes skips archived ones, Archived keeps only those,
  // and Shared (not in the search index) matches every typed word against title and body.
  const tabResults = useMemo(() => {
    if (view === "shared") {
      if (!shared) return undefined;
      const words = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
      return shared.filter(({ note }) => {
        const text = `${note.title} ${note.body}`.toLowerCase();
        return words.every((word) => text.includes(word));
      });
    }
    return searchResults
      ?.filter((note) => (view === "archived") === (note.archived === true))
      .map((note) => ({ note, subtitle: undefined }));
  }, [view, shared, searchResults, debouncedQuery]);
  const archivedQuery = useCachedPaginatedQuery(
    api.notes.listPage,
    view === "archived" ? { archived: true } : "skip",
    { initialNumItems: 50 },
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setSearchQuery("");
    setDebouncedQuery("");
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  }, []);

  const handleEndReached = useCallback(() => {
    if (isSearching) return;
    if (view === "archived") {
      if (archivedQuery.status === "CanLoadMore") {
        archivedQuery.loadMore(50);
      }
      return;
    }
    if (view === "shared") return;
    if (restQuery.status === "CanLoadMore") {
      restQuery.loadMore(50);
    } else if (pinnedQuery.status === "CanLoadMore") {
      pinnedQuery.loadMore(50);
    }
  }, [isSearching, view, archivedQuery, restQuery, pinnedQuery]);

  const searchTerms = useMemo(() => trimmedQuery.split(/\s+/).filter(Boolean), [trimmedQuery]);

  const listItems = useMemo<ListItem[]>(() => {
    if (isSearching) {
      if (!tabResults) return [];
      const items: ListItem[] = [];
      if (tabResults.length > 0) {
        items.push({ type: "header", id: "search-header", title: "Search results" });
        for (const { note } of tabResults) {
          items.push({ type: "note", id: note._id, note, terms: searchTerms });
        }
      }
      return items;
    }

    if (view === "shared") {
      if (!shared) return [];
      return shared.map((entry) => ({
        type: "note" as const,
        id: entry.note._id,
        note: entry.note,
        terms: [],
        subtitle: `${entry.ownerName ?? "Someone"} · ${entry.role === "edit" ? "Can edit" : "View only"}`,
      }));
    }

    if (view === "archived") {
      return archivedQuery.results.map((note) => ({
        type: "note" as const,
        id: note._id,
        note,
        terms: [],
      }));
    }

    const items: ListItem[] = [];
    if (pinnedQuery.results.length > 0) {
      items.push({ type: "header", id: "header-pinned", title: "Pinned" });
      for (const note of pinnedQuery.results) {
        items.push({ type: "note", id: note._id, note, terms: [] });
      }
    }

    if (restQuery.results.length > 0) {
      if (pinnedQuery.results.length > 0) {
        items.push({ type: "header", id: "header-rest", title: "Everything else" });
      }
      for (const note of restQuery.results) {
        items.push({ type: "note", id: note._id, note, terms: [] });
      }
    }

    return items;
  }, [
    isSearching,
    tabResults,
    searchTerms,
    view,
    shared,
    archivedQuery.results,
    pinnedQuery.results,
    restQuery.results,
  ]);

  const isLoadingSearch =
    isSearching && (trimmedQuery !== debouncedQuery || tabResults === undefined);
  const isLoadingInitial =
    !isSearching &&
    view === "all" &&
    pinnedQuery.status === "LoadingFirstPage" &&
    restQuery.status === "LoadingFirstPage";
  const isLoadingShared = !isSearching && view === "shared" && shared === undefined;
  const isLoadingArchived =
    !isSearching && view === "archived" && archivedQuery.status === "LoadingFirstPage";
  const isLoading = isLoadingSearch || isLoadingInitial || isLoadingShared || isLoadingArchived;

  const isSearchEmpty = isSearching && !isLoadingSearch && (tabResults?.length ?? 0) === 0;
  const isFeedEmpty =
    !isSearching &&
    !isLoadingInitial &&
    view === "all" &&
    pinnedQuery.results.length === 0 &&
    restQuery.results.length === 0;
  const isSharedEmpty =
    !isSearching && !isLoadingShared && view === "shared" && (shared?.length ?? 0) === 0;
  const isArchivedEmpty =
    !isSearching && !isLoadingArchived && view === "archived" && archivedQuery.results.length === 0;

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "header") {
      return (
        <Text style={[styles.sectionLabel, typography.number, { color: colors.muted }]}>
          {item.title}
        </Text>
      );
    }
    return (
      <NoteCard
        note={item.note}
        terms={item.terms}
        subtitle={item.subtitle}
        query={isSearching ? trimmedQuery : undefined}
      />
    );
  };

  const renderFooter = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.hanko} size="large" />
        </View>
      );
    }
    if (
      !isSearching &&
      (restQuery.status === "LoadingMore" || pinnedQuery.status === "LoadingMore")
    ) {
      return (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator color={colors.hanko} size="small" />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    if (isSearchEmpty) {
      return (
        <EmptyState
          icon={<Feather name="search" size={24} color={colors.muted} />}
          title="No matching notes"
          description={`Nothing matches “${trimmedQuery}”. Try fewer words.`}
        />
      );
    }
    if (isFeedEmpty) {
      return (
        <EmptyState
          icon={<Feather name="file-text" size={24} color={colors.muted} />}
          title="Your first note is one tap away"
          description="Notes save as you type."
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Write a note"
              onPress={handleCreateNote}
              disabled={isCreating}
              style={({ pressed }) => [
                styles.newNoteBtn,
                {
                  backgroundColor: colors.hanko,
                  borderRadius: radii.controls,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="edit-3" size={16} color="#FFFFFF" />
              <Text style={styles.newNoteBtnText}>Write a note</Text>
            </Pressable>
          }
        />
      );
    }
    if (isSharedEmpty) {
      return (
        <EmptyState
          icon={<Feather name="users" size={24} color={colors.muted} />}
          title="Nothing shared with you yet"
          description="When someone shares a note with your email, it shows up here."
        />
      );
    }
    if (isArchivedEmpty) {
      return (
        <EmptyState
          icon={<Feather name="archive" size={24} color={colors.muted} />}
          title="No archived notes"
          description="Archive a note from its ⋯ menu to tuck it away without deleting it."
        />
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View
          style={[
            styles.segmentedControl,
            {
              borderColor: colors.border,
              borderRadius: radii.controls,
              backgroundColor: colors.card,
            },
          ]}
        >
          {(
            [
              ["all", "Notes"],
              ["shared", "Shared"],
              ["archived", "Archived"],
            ] as const
          ).map(([key, label]) => {
            const selected = view === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setView(key)}
                style={[
                  styles.segment,
                  selected && {
                    backgroundColor: colors.ink,
                    borderRadius: radii.controls - 2,
                  },
                ]}
              >
                <Text
                  style={[styles.segmentText, { color: selected ? colors.paper : colors.muted }]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={listItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: bottomInset,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.hanko}
            colors={[colors.hanko]}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />

      {searchVisible && (
        <BottomSearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes…"
          autoFocus={Platform.OS === "android"}
          // Dismissing the keyboard with nothing typed puts the field away again.
          onBlur={() => {
            if (Platform.OS === "android" && !searchQuery.trim()) closeSearch();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  segmentedControl: {
    height: 34,
    borderWidth: 1,
    padding: 2,
    flexDirection: "row",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 8,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  newNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  newNoteBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
