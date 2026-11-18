import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../../../src/theme";
import { useTabBarInset } from "../../../src/components/glass";
import { EmptyState } from "../../../src/notes/empty-state";
import { NoteCard } from "../../../src/notes/note-card";

type ListItem =
  | { type: "header"; id: string; title: string }
  | { type: "note"; id: string; note: Doc<"notes">; terms: string[] };

export default function NotesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const tabBarInset = useTabBarInset();
  const { colors, radii, typography } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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

  // Set tab header right button
  /* oxlint-disable react/no-unstable-nested-components */
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New note"
          onPress={handleCreateNote}
          disabled={isCreating}
          hitSlop={8}
          style={({ pressed }) => [
            styles.headerBtn,
            {
              opacity: pressed || isCreating ? 0.6 : 1,
            },
          ]}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color={colors.hanko} />
          ) : (
            <Feather name="edit-3" size={20} color={colors.hanko} />
          )}
        </Pressable>
      ),
    });
  }, [navigation, colors.hanko, handleCreateNote, isCreating]);
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
    debouncedQuery ? { query: debouncedQuery } : "skip",
  );

  // Paginated lists
  const pinnedQuery = usePaginatedQuery(
    api.notes.listPage,
    { pinned: true },
    { initialNumItems: 50 },
  );
  const restQuery = usePaginatedQuery(
    api.notes.listPage,
    { pinned: false },
    { initialNumItems: 50 },
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSearchQuery("");
    setDebouncedQuery("");
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  }, []);

  const handleEndReached = useCallback(() => {
    if (isSearching) return;
    if (restQuery.status === "CanLoadMore") {
      restQuery.loadMore(50);
    } else if (pinnedQuery.status === "CanLoadMore") {
      pinnedQuery.loadMore(50);
    }
  }, [isSearching, restQuery, pinnedQuery]);

  const searchTerms = useMemo(() => trimmedQuery.split(/\s+/).filter(Boolean), [trimmedQuery]);

  const listItems = useMemo<ListItem[]>(() => {
    if (isSearching) {
      if (!searchResults) return [];
      const items: ListItem[] = [];
      if (searchResults.length > 0) {
        items.push({ type: "header", id: "search-header", title: "Search results" });
        for (const note of searchResults) {
          items.push({ type: "note", id: note._id, note, terms: searchTerms });
        }
      }
      return items;
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
  }, [isSearching, searchResults, searchTerms, pinnedQuery.results, restQuery.results]);

  const isLoadingSearch =
    isSearching && (trimmedQuery !== debouncedQuery || searchResults === undefined);
  const isLoadingInitial =
    !isSearching &&
    pinnedQuery.status === "LoadingFirstPage" &&
    restQuery.status === "LoadingFirstPage";

  const isSearchEmpty = isSearching && !isLoadingSearch && (searchResults?.length ?? 0) === 0;
  const isFeedEmpty =
    !isSearching &&
    !isLoadingInitial &&
    pinnedQuery.results.length === 0 &&
    restQuery.results.length === 0;

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
        query={isSearching ? trimmedQuery : undefined}
      />
    );
  };

  const renderFooter = () => {
    if (isLoadingSearch || isLoadingInitial) {
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
    if (isLoadingSearch || isLoadingInitial) return null;
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
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View
          style={[
            styles.searchField,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radii.controls,
            },
          ]}
        >
          <Feather name="search" size={18} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes…"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.ink }]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchQuery("")}
              style={styles.clearBtn}
            >
              <Feather name="x" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={listItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: tabBarInset + 16,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    height: 44,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
  },
  clearBtn: {
    padding: 4,
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
