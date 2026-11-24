import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { BottomSearchBar, useBottomSearchInset } from "../../../src/components/bottom-search-bar";
import { Feather } from "@expo/vector-icons";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc, Id } from "@inkmark/backend/convex/_generated/dataModel";
import type { SeriesKind, SeriesStatus } from "@inkmark/backend/convex/validators";
import { useTheme } from "../../../src/theme";
import { HeaderActions, HeaderIconButton } from "../../../src/components/profile-button";
import { SeriesCard } from "../../../src/library/series-card";
import { LabelFilterModal, TypeFilterModal } from "../../../src/library/filter-sheet";
import { STATUS_LABEL } from "../../../src/library/series";

type FilterStatus = SeriesStatus | "all";

const STATUS_CHIPS: FilterStatus[] = [
  "reading",
  "planned",
  "on_hold",
  "completed",
  "dropped",
  "all",
];

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const bottomInset = useBottomSearchInset();
  const { colors, radii, typography } = useTheme();

  // Filters state
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("reading");
  const [selectedKinds, setSelectedKinds] = useState<SeriesKind[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Id<"labels">[]>([]);

  // Filter modal visibility
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [labelModalVisible, setLabelModalVisible] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Labels map
  const allLabels = useQuery(api.labels.list);
  const labelsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!allLabels) return map;
    for (const label of allLabels) {
      map.set(label._id, label.name);
    }
    return map;
  }, [allLabels]);

  const handleNavigateNew = useCallback(() => {
    router.push("/library/new");
  }, [router]);

  // iOS: "Add to library" in the header. Android has it in the bottom bar.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    navigation.setOptions({
      // oxlint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <HeaderActions>
          <HeaderIconButton icon="plus" label="Add to library" onPress={handleNavigateNew} />
        </HeaderActions>
      ),
    });
  }, [navigation, handleNavigateNew]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const q = searchQuery.trim();
  const isSearchActive = q.length > 0;

  // Search query
  const searchResults = useQuery(
    api.library.search,
    isSearchActive && debouncedQuery.length > 0 ? { query: debouncedQuery } : "skip",
  );

  // Paginated list query
  const listQueryArgs = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      kinds: selectedKinds.length > 0 ? selectedKinds : undefined,
      labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
    }),
    [statusFilter, selectedKinds, selectedLabelIds],
  );

  const {
    results: paginatedResults,
    status: paginationStatus,
    loadMore,
    isLoading: isListLoading,
  } = usePaginatedQuery(api.library.listPage, listQueryArgs, { initialNumItems: 50 });

  const handleEndReached = useCallback(() => {
    if (!isSearchActive && paginationStatus === "CanLoadMore") {
      loadMore(50);
    }
  }, [isSearchActive, paginationStatus, loadMore]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, []);

  const displayItems: Doc<"series">[] = isSearchActive ? (searchResults ?? []) : paginatedResults;

  const isLoading = isSearchActive
    ? searchResults === undefined
    : isListLoading && paginatedResults.length === 0;

  const renderHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Filter Row (hidden during active search) */}
      {!isSearchActive && (
        <View style={styles.filterSection}>
          {/* Status chips scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusChipsContainer}
          >
            {STATUS_CHIPS.map((chip) => {
              const isSelected = statusFilter === chip;
              const chipLabel = chip === "all" ? "All" : STATUS_LABEL[chip];
              return (
                <Pressable
                  key={chip}
                  accessibilityRole="tab"
                  accessibilityLabel={`Filter by ${chipLabel}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setStatusFilter(chip)}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: isSelected ? colors.hanko : colors.card,
                      borderColor: isSelected ? colors.hanko : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: isSelected ? "#FFFFFF" : colors.muted,
                        fontWeight: isSelected ? "600" : "500",
                      },
                    ]}
                  >
                    {chipLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Type & Label Filter Buttons */}
          <View style={styles.secondaryFilterRow}>
            {/* Type Filter */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filter by type. ${selectedKinds.length} selected`}
              onPress={() => setTypeModalVisible(true)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selectedKinds.length > 0 ? colors.hanko : colors.card,
                  borderColor: selectedKinds.length > 0 ? colors.hanko : colors.border,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Feather
                name="filter"
                size={13}
                color={selectedKinds.length > 0 ? "#FFFFFF" : colors.muted}
              />
              <Text
                style={[
                  styles.filterPillText,
                  {
                    color: selectedKinds.length > 0 ? "#FFFFFF" : colors.ink,
                  },
                ]}
              >
                {selectedKinds.length === 0
                  ? "All types"
                  : selectedKinds.length === 1
                    ? selectedKinds[0]
                    : `Types (${selectedKinds.length})`}
              </Text>
              <Feather
                name="chevron-down"
                size={14}
                color={selectedKinds.length > 0 ? "#FFFFFF" : colors.muted}
              />
            </Pressable>

            {/* Label Filter */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filter by label. ${selectedLabelIds.length} selected`}
              onPress={() => setLabelModalVisible(true)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selectedLabelIds.length > 0 ? colors.hanko : colors.card,
                  borderColor: selectedLabelIds.length > 0 ? colors.hanko : colors.border,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Feather
                name="tag"
                size={13}
                color={selectedLabelIds.length > 0 ? "#FFFFFF" : colors.muted}
              />
              <Text
                style={[
                  styles.filterPillText,
                  {
                    color: selectedLabelIds.length > 0 ? "#FFFFFF" : colors.ink,
                  },
                ]}
              >
                {selectedLabelIds.length === 0
                  ? "All labels"
                  : selectedLabelIds.length === 1
                    ? (labelsMap.get(selectedLabelIds[0]) ?? "1 label")
                    : `Labels (${selectedLabelIds.length})`}
              </Text>
              <Feather
                name="chevron-down"
                size={14}
                color={selectedLabelIds.length > 0 ? "#FFFFFF" : colors.muted}
              />
            </Pressable>

            {/* Clear filters button */}
            {(selectedKinds.length > 0 || selectedLabelIds.length > 0) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset type and label filters"
                onPress={() => {
                  setSelectedKinds([]);
                  setSelectedLabelIds([]);
                }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <Feather name="x" size={13} color={colors.destructive} />
                <Text style={[styles.filterPillText, { color: colors.destructive }]}>Reset</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Search results summary count */}
      {isSearchActive && searchResults !== undefined && (
        <Text style={[styles.resultsCountText, { color: colors.muted }]}>
          {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
        </Text>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={colors.hanko} />
        </View>
      );
    }

    if (isSearchActive) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="search" size={40} color={colors.muted} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, typography.display, { color: colors.ink }]}>
            Not in your library
          </Text>
          <Text style={[styles.emptySubtitle, typography.bodySm, { color: colors.muted }]}>
            Nothing matches “{q}”.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add to library"
            onPress={() => router.push("/library/new")}
            style={[
              styles.emptyActionBtn,
              {
                backgroundColor: colors.hanko,
                borderRadius: radii.controls,
              },
            ]}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.emptyActionBtnText}>Add to library</Text>
          </Pressable>
        </View>
      );
    }

    const isFiltered =
      statusFilter !== "reading" || selectedKinds.length > 0 || selectedLabelIds.length > 0;

    if (isFiltered) {
      const statusTitle = statusFilter === "all" ? "All" : STATUS_LABEL[statusFilter];
      return (
        <View style={styles.emptyContainer}>
          <Feather name="book-open" size={40} color={colors.muted} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, typography.display, { color: colors.ink }]}>
            Nothing in “{statusTitle}”
          </Text>
          <Text style={[styles.emptySubtitle, typography.bodySm, { color: colors.muted }]}>
            Try changing the status, type, or label filters.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Feather name="book-open" size={44} color={colors.hanko} style={styles.emptyIcon} />
        <Text style={[styles.emptyTitle, typography.display, { color: colors.ink }]}>
          Track what you're reading
        </Text>
        <Text style={[styles.emptySubtitle, typography.bodySm, { color: colors.muted }]}>
          Add a series once, then bump the chapter with one tap.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add to library"
          onPress={() => router.push("/library/new")}
          style={[
            styles.emptyActionBtn,
            {
              backgroundColor: colors.hanko,
              borderRadius: radii.controls,
            },
          ]}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.emptyActionBtnText}>Add to library</Text>
        </Pressable>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isSearchActive && paginationStatus === "LoadingMore") {
      return (
        <View style={[styles.footerLoading, { marginBottom: bottomInset }]}>
          <ActivityIndicator size="small" color={colors.hanko} />
        </View>
      );
    }
    return <View style={{ height: bottomInset }} />;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      <FlatList
        data={displayItems}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <SeriesCard series={item} labelsMap={labelsMap} />}
        // An element, not the function: a new function each render makes
        // FlatList remount the header, which drops the search box's focus.
        ListHeaderComponent={renderHeader()}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.hanko}
            colors={[colors.hanko]}
          />
        }
      />

      {/* Type Filter Modal */}
      <TypeFilterModal
        visible={typeModalVisible}
        onClose={() => setTypeModalVisible(false)}
        selectedKinds={selectedKinds}
        onSelectKinds={setSelectedKinds}
      />

      {/* Label Filter Modal */}
      <LabelFilterModal
        visible={labelModalVisible}
        onClose={() => setLabelModalVisible(false)}
        selectedLabelIds={selectedLabelIds}
        onSelectLabelIds={setSelectedLabelIds}
      />

      <BottomSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search titles and alternative names…"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listHeaderContainer: {
    marginBottom: 12,
  },
  filterSection: {
    marginTop: 12,
    gap: 10,
  },
  statusChipsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 13,
  },
  secondaryFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 5,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  resultsCountText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
  },
  centerLoading: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  emptyActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
