import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { dialog } from "../../../src/components/dialog";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTabBarInset } from "../../../src/components/glass";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { useCachedQuery, useSavedListItem } from "../../../src/offline";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Id } from "@inkmark/backend/convex/_generated/dataModel";
import type { SeriesKind, SeriesStatus } from "@inkmark/backend/convex/validators";
import { useTheme } from "../../../src/theme";
import { haptics } from "../../../src/haptics";
import { AniListControls } from "../../../src/library/anilist-controls";
import {
  formatChapter,
  isEpisodic,
  isHttpUrl,
  isReadingLink,
  isWatchKind,
  KIND_OPTIONS,
  linkName,
  nextReadUrl,
  progressLabel,
  seriesLinks,
  STATUS_ORDER,
  statusLabel,
} from "../../../src/library/series";
import { relativeTime, fullDate } from "../../../src/library/time";

export default function SeriesDetailScreen() {
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const { colors, radii, typography } = useTheme();

  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const id = seriesId ? (seriesId as Id<"series">) : undefined;

  const opened = useCachedQuery(api.series.get, id ? { id } : "skip");
  // Offline, a series that was listed but never opened still opens from the saved list.
  const listed = useSavedListItem(api.library.listPage, id);
  const series = opened === undefined ? listed : opened;
  const history = useCachedQuery(api.series.history, id ? { seriesId: id } : "skip");
  const pastSeasons = useCachedQuery(api.series.seasons, id ? { seriesId: id } : "skip");
  const allLabels = useCachedQuery(api.labels.list, {}) ?? [];

  const update = useMutation(api.series.update);
  const setChapter = useMutation(api.series.setChapter);
  const nextSeason = useMutation(api.series.nextSeason);
  const setPastSeason = useMutation(api.series.setPastSeason);
  const bump = useMutation(api.series.bump);
  const remove = useMutation(api.series.remove);
  const createLabel = useMutation(api.labels.create);

  // Modal states
  const [chapterModalVisible, setChapterModalVisible] = useState(false);
  const [chapterInputVal, setChapterInputVal] = useState("");
  const [isSettingChapter, setIsSettingChapter] = useState(false);

  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [newLabelText, setNewLabelText] = useState("");

  const [addLinkModalVisible, setAddLinkModalVisible] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");

  const [editDetailsVisible, setEditDetailsVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAltNames, setEditAltNames] = useState("");
  const [editGenres, setEditGenres] = useState("");
  const [editTotalChapters, setEditTotalChapters] = useState("");

  const handleOpenEdit = () => {
    if (!series) return;
    setEditTitle(series.title);
    setEditDescription(series.description ?? "");
    setEditAltNames((series.altNames ?? []).join(", "));
    setEditGenres((series.genres ?? []).join(", "));
    setEditTotalChapters(
      series.totalChapters !== undefined && series.totalChapters !== null
        ? String(series.totalChapters)
        : "",
    );
    setEditDetailsVisible(true);
  };

  // Loading state
  if (series === undefined) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.paper }]}>
        <ActivityIndicator size="small" color={colors.hanko} />
      </View>
    );
  }

  // Not found state
  if (series === null) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.paper }]}>
        <Feather name="book" size={44} color={colors.muted} style={styles.missingIcon} />
        <Text style={[styles.missingTitle, typography.display, { color: colors.ink }]}>
          This series isn't in your library
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to library"
          onPress={() => router.replace("/library")}
          style={[
            styles.backBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radii.controls,
            },
          ]}
        >
          <Feather name="arrow-left" size={16} color={colors.ink} />
          <Text style={[styles.backBtnText, { color: colors.ink }]}>Back to Library</Text>
        </Pressable>
      </View>
    );
  }

  const episodic = isEpisodic(series.kind);
  const isMovie = series.kind === "movie";
  const links = seriesLinks(series);
  const next = series.chapter + 1;
  const nextUrl = nextReadUrl(series, next);
  const progress = series.totalChapters ? Math.min(1, series.chapter / series.totalChapters) : null;

  const handleBumpPlus = async () => {
    haptics.tap();
    try {
      await bump({ id: series._id, delta: 1 });
    } catch (err) {
      console.error("Bump error:", err);
    }
  };

  const handleBumpMinus = async () => {
    if (series.chapter <= 0) return;
    haptics.tap();
    try {
      await bump({ id: series._id, delta: -1 });
    } catch (err) {
      console.error("Bump minus error:", err);
    }
  };

  const handleNextSeason = async () => {
    haptics.tap();
    try {
      await nextSeason({ id: series._id });
    } catch (err) {
      console.error("Next season error:", err);
    }
  };

  const handleOpenSetChapter = () => {
    setChapterInputVal(formatChapter(series.chapter));
    setChapterModalVisible(true);
  };

  const handleSaveChapter = async () => {
    const num = Number(chapterInputVal.trim());
    if (!Number.isFinite(num) || num < 0) {
      dialog.alert("Invalid number", "Please enter a valid non-negative number like 12 or 12.5");
      return;
    }
    setIsSettingChapter(true);
    try {
      await setChapter({ id: series._id, chapter: num });
      setChapterModalVisible(false);
    } catch (err) {
      console.error("Set chapter error:", err);
      dialog.alert("Error", "Could not update chapter. Please try again.");
    } finally {
      setIsSettingChapter(false);
    }
  };

  const handleStatusChange = async (status: SeriesStatus) => {
    haptics.select();
    try {
      await update({ id: series._id, status });
    } catch (err) {
      console.error("Update status error:", err);
    }
  };

  const handleKindChange = async (kind: SeriesKind) => {
    try {
      await update({ id: series._id, kind });
    } catch (err) {
      console.error("Update kind error:", err);
    }
  };

  const handleToggleLabel = async (labelId: Id<"labels">) => {
    const current = series.labelIds ?? [];
    const nextIds = current.includes(labelId)
      ? current.filter((lid) => lid !== labelId)
      : [...current, labelId];
    try {
      await update({ id: series._id, labelIds: nextIds });
    } catch (err) {
      console.error("Toggle label error:", err);
    }
  };

  const handleCreateLabel = async () => {
    const trimmed = newLabelText.trim();
    if (!trimmed) return;
    try {
      const lid = await createLabel({ name: trimmed });
      setNewLabelText("");
      if (lid) {
        const current = series.labelIds ?? [];
        if (!current.includes(lid)) {
          await update({ id: series._id, labelIds: [...current, lid] });
        }
      }
    } catch (err) {
      console.error("Create label error:", err);
    }
  };

  const handleOpenLink = async (url: string, isReadingNext = false) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await WebBrowser.openBrowserAsync(url, {
          toolbarColor: colors.paper,
          controlsColor: colors.hanko,
        }).catch(() => Linking.openURL(url));
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error("Open URL error:", err);
    }
    if (isReadingNext) {
      void setChapter({ id: series._id, chapter: next });
    }
  };

  const handleAddLink = async () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    if (!isHttpUrl(url)) {
      dialog.alert("Invalid URL", "Links must start with http:// or https://");
      return;
    }
    if (links.some((l) => l.url === url)) {
      dialog.alert("Duplicate Link", "That link is already saved.");
      return;
    }
    const label = newLinkLabel.trim();
    const nextLinks = [...links, label ? { url, label } : { url }];
    try {
      await update({ id: series._id, links: nextLinks });
      setNewLinkUrl("");
      setNewLinkLabel("");
      setAddLinkModalVisible(false);
    } catch (err) {
      console.error("Add link error:", err);
      dialog.alert("Error", "Could not save link.");
    }
  };

  const handleRemoveLink = async (index: number) => {
    const nextLinks = links.filter((_, i) => i !== index);
    try {
      await update({ id: series._id, links: nextLinks });
    } catch (err) {
      console.error("Remove link error:", err);
    }
  };

  const handleSaveDetails = async () => {
    const titleTrimmed = editTitle.trim();
    if (!titleTrimmed) {
      dialog.alert("Required", "Title is required");
      return;
    }
    const altNamesArr = editAltNames
      .split(/[,·]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const genresArr = editGenres
      .split(/[,·]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const totNum = Number(editTotalChapters.trim());
    const totalChaptersVal =
      editTotalChapters.trim() && Number.isFinite(totNum) && totNum > 0 ? totNum : null;

    try {
      await update({
        id: series._id,
        title: titleTrimmed,
        description: editDescription.trim(),
        altNames: altNamesArr,
        genres: genresArr,
        totalChapters: totalChaptersVal,
      });
      setEditDetailsVisible(false);
    } catch (err) {
      console.error("Save details error:", err);
      dialog.alert("Error", "Could not save series details.");
    }
  };

  const handleConfirmDelete = () => {
    haptics.warning();
    dialog.alert(`Remove ${series.title}?`, "Its history goes too. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            router.back();
            await remove({ id: series._id });
          } catch (err) {
            console.error("Remove series error:", err);
          }
        },
      },
    ]);
  };

  const seriesLabels = allLabels.filter((l) => series.labelIds?.includes(l._id));

  return (
    <>
      <Stack.Screen
        options={{
          // The page opens with the title as its heading; repeating it in the bar reads twice.
          title: "",
          headerBackTitle: "Library",
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.paper }]}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + 40 }]}
      >
        {/* Title and Edit Button */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, typography.display, { color: colors.ink }]}>
            {series.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit details"
            onPress={handleOpenEdit}
            style={({ pressed }) => [
              styles.editButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="edit-2" size={16} color={colors.ink} />
          </Pressable>
        </View>

        {/* Alternative names */}
        {series.altNames && series.altNames.length > 0 ? (
          <Text style={[styles.altNames, typography.bodySm, { color: colors.muted }]}>
            {series.altNames.join(" · ")}
          </Text>
        ) : null}

        {/* Labels row */}
        <View style={styles.labelsContainer}>
          {seriesLabels.map((label) => (
            <View key={label._id} style={[styles.labelTag, { backgroundColor: colors.hanko }]}>
              <Text style={styles.labelTagText}>{label.name}</Text>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage labels"
            onPress={() => setLabelModalVisible(true)}
            style={[
              styles.addLabelBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <Feather name="tag" size={12} color={colors.muted} />
            <Text style={[styles.addLabelBtnText, { color: colors.muted }]}>
              {seriesLabels.length > 0 ? "Edit labels" : "Add label"}
            </Text>
          </Pressable>
        </View>

        {/* Progress Card Section */}
        {isMovie ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>MOVIE STATUS</Text>
            <View style={styles.movieRow}>
              <View>
                <Text style={[styles.movieStatusVal, typography.display, { color: colors.ink }]}>
                  {statusLabel(series.status, series.kind)}
                </Text>
                <Text style={[styles.updatedText, { color: colors.muted }]}>
                  Updated {relativeTime(series.lastReadAt)}
                </Text>
              </View>
              {series.status !== "completed" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark watched"
                  onPress={() => void update({ id: series._id, status: "completed" })}
                  style={[
                    styles.primaryActionBtn,
                    {
                      backgroundColor: colors.hanko,
                      borderRadius: radii.controls,
                    },
                  ]}
                >
                  <Text style={styles.primaryActionBtnText}>Mark watched</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark unwatched"
                  onPress={() => void update({ id: series._id, status: "reading" })}
                  style={[
                    styles.secondaryActionBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceHighlight,
                      borderRadius: radii.controls,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryActionBtnText, { color: colors.ink }]}>
                    Mark unwatched
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            {/* Header: Progress title and season info */}
            <View style={styles.cardProgressHeader}>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                {episodic ? "EPISODE PROGRESS" : "CHAPTER PROGRESS"}
              </Text>
              {episodic && (
                <Text style={[styles.seasonSubtitle, { color: colors.muted }]}>
                  Season {series.season ?? 1}
                  {series.totalSeasons ? ` of ${series.totalSeasons}` : ""}
                </Text>
              )}
            </View>

            {/* Stepper & Number */}
            <View style={styles.stepperSectionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set chapter number"
                onPress={handleOpenSetChapter}
                style={styles.chapterTouchable}
              >
                {episodic && (
                  <Text
                    style={[styles.seasonBadgeText, typography.number, { color: colors.muted }]}
                  >
                    S{series.season ?? 1} E
                  </Text>
                )}
                <Text style={[styles.bigChapterNumber, typography.number, { color: colors.ink }]}>
                  {formatChapter(series.chapter)}
                </Text>
                {series.totalChapters ? (
                  <Text style={[styles.bigTotalNumber, typography.number, { color: colors.muted }]}>
                    {" "}
                    / {formatChapter(series.totalChapters)}
                  </Text>
                ) : null}
                <Feather
                  name="edit-3"
                  size={14}
                  color={colors.muted}
                  style={styles.chapterEditIcon}
                />
              </Pressable>

              {/* Stepper Controls */}
              <View style={styles.controlsCluster}>
                {episodic && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start next season"
                    onPress={handleNextSeason}
                    style={({ pressed }) => [
                      styles.nextSeasonBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceHighlight,
                        borderRadius: radii.controls,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Feather name="fast-forward" size={14} color={colors.ink} />
                    <Text style={[styles.nextSeasonBtnText, { color: colors.ink }]}>Next S</Text>
                  </Pressable>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="One chapter back"
                  disabled={series.chapter <= 0}
                  onPress={handleBumpMinus}
                  style={({ pressed }) => [
                    styles.stepBtnMinus,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.paper,
                      opacity: series.chapter <= 0 ? 0.35 : pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  <Feather name="minus" size={18} color={colors.ink} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="One chapter forward"
                  onPress={handleBumpPlus}
                  style={({ pressed }) => [
                    styles.stepBtnPlus,
                    {
                      backgroundColor: colors.hanko,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                >
                  <Feather name="plus" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            <Text style={[styles.updatedText, { color: colors.muted }]}>
              Updated {relativeTime(series.lastReadAt)}
            </Text>

            {episodic && pastSeasons && pastSeasons.length > 0 ? (
              <View style={[styles.pastSeasonsContainer, { borderTopColor: colors.border }]}>
                <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                  EARLIER SEASONS
                </Text>
                {pastSeasons.map((pastSeason) => (
                  <PastSeasonRow
                    key={pastSeason.season}
                    season={pastSeason.season}
                    chapter={pastSeason.chapter}
                    onSave={(chapter) =>
                      setPastSeason({
                        id: series._id,
                        season: pastSeason.season,
                        chapter,
                      })
                    }
                  />
                ))}
              </View>
            ) : null}

            {/* Progress bar */}
            {progress !== null && (
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: colors.hanko,
                    },
                  ]}
                />
              </View>
            )}

            {/* Read / Watch Next Action */}
            {nextUrl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${isWatchKind(series.kind) ? "Watch" : "Read"} next`}
                onPress={() => handleOpenLink(nextUrl, true)}
                style={({ pressed }) => [
                  styles.readNextActionButton,
                  {
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather
                  name={isWatchKind(series.kind) ? "play" : "book-open"}
                  size={16}
                  color={colors.hanko}
                />
                <Text style={[styles.readNextActionText, { color: colors.ink }]}>
                  {isWatchKind(series.kind) ? "Watch" : "Read"}{" "}
                  {episodic
                    ? `S${series.season ?? 1} · E${formatChapter(next)}`
                    : `${progressLabel(series.kind)} ${formatChapter(next)}`}
                </Text>
                <Feather name="external-link" size={14} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Kind & Status Pickers */}
        <View style={styles.gridTwo}>
          {/* Status Picker */}
          <View
            style={[
              styles.pickerBox,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[styles.pickerBoxLabel, { color: colors.muted }]}>STATUS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipScrollContent}
            >
              {STATUS_ORDER.map((s) => {
                const isSelected = series.status === s;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityLabel={statusLabel(s, series.kind)}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleStatusChange(s)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? colors.hanko : colors.surfaceHighlight,
                        borderColor: isSelected ? colors.hanko : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        {
                          color: isSelected ? "#FFFFFF" : colors.ink,
                          fontWeight: isSelected ? "600" : "500",
                        },
                      ]}
                    >
                      {statusLabel(s, series.kind)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Type Picker */}
          <View
            style={[
              styles.pickerBox,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[styles.pickerBoxLabel, { color: colors.muted }]}>TYPE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipScrollContent}
            >
              {KIND_OPTIONS.map((item) => {
                const isSelected = series.kind === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleKindChange(item.value)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? colors.hanko : colors.surfaceHighlight,
                        borderColor: isSelected ? colors.hanko : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        {
                          color: isSelected ? "#FFFFFF" : colors.ink,
                          fontWeight: isSelected ? "600" : "500",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <AniListControls series={series} />

        {/* Description */}
        {series.description ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>DESCRIPTION</Text>
            <Text style={[styles.descriptionText, typography.body, { color: colors.ink }]}>
              {series.description}
            </Text>
          </View>
        ) : null}

        {/* Genres */}
        {series.genres && series.genres.length > 0 ? (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>GENRES</Text>
            <View style={styles.genreChipsRow}>
              {series.genres.map((g) => (
                <View
                  key={g}
                  style={[
                    styles.genreChip,
                    {
                      backgroundColor: colors.surfaceHighlight,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.genreChipText, { color: colors.ink }]}>{g}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Links Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>LINKS</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add link"
              onPress={() => setAddLinkModalVisible(true)}
              style={styles.smallAddLinkBtn}
            >
              <Feather name="plus" size={14} color={colors.hanko} />
              <Text style={[styles.smallAddLinkBtnText, { color: colors.hanko }]}>Add link</Text>
            </Pressable>
          </View>

          {links.length === 0 ? (
            <Text style={[styles.emptyLinksText, { color: colors.muted }]}>
              No links saved. Add a reading/watching template or website link.
            </Text>
          ) : (
            <View style={styles.linksList}>
              {links.map((link, i) => {
                const isReading = isReadingLink(link.url);
                return (
                  <View
                    key={`${i}:${link.url}`}
                    style={[
                      styles.linkItemRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceHighlight,
                        borderRadius: radii.controls,
                      },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${linkName(link)}`}
                      onPress={() =>
                        handleOpenLink(
                          isReading
                            ? (nextUrl ?? link.url.replaceAll("{n}", String(series.chapter)))
                            : link.url,
                          false,
                        )
                      }
                      style={styles.linkItemContent}
                    >
                      <View style={styles.linkBadgeAndName}>
                        <Text
                          style={[
                            styles.linkTypeTag,
                            {
                              color: isReading ? colors.hanko : colors.muted,
                            },
                          ]}
                        >
                          {isReading ? "READING" : "WEBSITE"}
                        </Text>
                        <Text
                          style={[styles.linkItemName, { color: colors.ink }]}
                          numberOfLines={1}
                        >
                          {linkName(link)}
                        </Text>
                      </View>
                      <Text style={[styles.linkItemUrl, { color: colors.muted }]} numberOfLines={1}>
                        {link.url}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove link"
                      onPress={() => handleRemoveLink(i)}
                      style={styles.removeLinkBtn}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* History Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>HISTORY</Text>
          {history && history.length > 0 ? (
            <View style={styles.historyList}>
              {history.map((h, i) => {
                const label =
                  h.season !== undefined && h.season > 0
                    ? `S${h.season} · E${formatChapter(h.chapter)}`
                    : `${progressLabel(series.kind) === "Episode" ? "Ep." : "Ch."} ${formatChapter(h.chapter)}`;
                return (
                  <View key={h._id} style={styles.historyItem}>
                    <View
                      style={[
                        styles.historyDot,
                        {
                          backgroundColor: i === 0 ? colors.hanko : colors.border,
                        },
                      ]}
                    />
                    <Text style={[styles.historyLabel, typography.number, { color: colors.ink }]}>
                      {label}
                    </Text>
                    <Text style={[styles.historyTime, { color: colors.muted }]}>
                      {relativeTime(h.at)} · {fullDate(h.at)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.emptyHistoryText, { color: colors.muted }]}>
              Progress changes will appear here.
            </Text>
          )}
        </View>

        {/* Delete / Remove Action */}
        <View style={styles.deleteSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove from library"
            onPress={handleConfirmDelete}
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                borderColor: colors.destructive,
                borderRadius: radii.controls,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
              Remove from library
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Set Chapter Modal */}
      <Modal
        visible={chapterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChapterModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setChapterModalVisible(false)}>
          <Pressable
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalBoxTitle, typography.display, { color: colors.ink }]}>
              Set {episodic ? "Episode" : "Chapter"}
            </Text>
            <TextInput
              selectionColor={colors.hanko}
              cursorColor={colors.hanko}
              value={chapterInputVal}
              onChangeText={setChapterInputVal}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={[
                styles.chapterModalInput,
                typography.number,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceHighlight,
                  borderRadius: radii.controls,
                },
              ]}
              onSubmitEditing={handleSaveChapter}
              returnKeyType="done"
            />
            <View style={styles.modalActionButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => setChapterModalVisible(false)}
                style={[
                  styles.modalCancelBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save chapter"
                disabled={isSettingChapter}
                onPress={handleSaveChapter}
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor: colors.hanko,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={styles.modalSubmitBtnText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Label Management Modal */}
      <Modal
        visible={labelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLabelModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLabelModalVisible(false)}>
          <Pressable
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalBoxTitle, typography.display, { color: colors.ink }]}>
                Labels
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setLabelModalVisible(false)}
              >
                <Feather name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>

            {/* Create new label */}
            <View style={styles.createLabelInputRow}>
              <TextInput
                selectionColor={colors.hanko}
                cursorColor={colors.hanko}
                value={newLabelText}
                onChangeText={setNewLabelText}
                placeholder="New label name…"
                placeholderTextColor={colors.muted}
                style={[
                  styles.textInputCommon,
                  {
                    flex: 1,
                    color: colors.ink,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls,
                  },
                ]}
                onSubmitEditing={handleCreateLabel}
                returnKeyType="done"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add label"
                onPress={handleCreateLabel}
                style={[
                  styles.createLabelAddBtn,
                  {
                    backgroundColor: colors.hanko,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={styles.modalSubmitBtnText}>Add</Text>
              </Pressable>
            </View>

            {/* Label checklist */}
            <ScrollView style={styles.labelChecklist}>
              {allLabels.length === 0 ? (
                <Text style={[styles.emptyModalText, { color: colors.muted }]}>
                  No labels created yet. Type above to add one.
                </Text>
              ) : (
                allLabels.map((l) => {
                  const isChecked = series.labelIds?.includes(l._id);
                  return (
                    <Pressable
                      key={l._id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={l.name}
                      accessibilityState={{ checked: isChecked }}
                      onPress={() => handleToggleLabel(l._id)}
                      style={[
                        styles.labelCheckItem,
                        {
                          borderColor: colors.border,
                          backgroundColor: isChecked ? colors.surfaceHighlight : "transparent",
                        },
                      ]}
                    >
                      <Text style={[styles.labelCheckItemText, { color: colors.ink }]}>
                        {l.name}
                      </Text>
                      <View
                        style={[
                          styles.checkboxSmall,
                          {
                            borderColor: isChecked ? colors.hanko : colors.border,
                            backgroundColor: isChecked ? colors.hanko : "transparent",
                          },
                        ]}
                      >
                        {isChecked && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Link Modal */}
      <Modal
        visible={addLinkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddLinkModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddLinkModalVisible(false)}>
          <Pressable
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalBoxTitle, typography.display, { color: colors.ink }]}>
                Add Link
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setAddLinkModalVisible(false)}
              >
                <Feather name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={[styles.inputFieldLabel, { color: colors.muted }]}>URL</Text>
            <TextInput
              selectionColor={colors.hanko}
              cursorColor={colors.hanko}
              value={newLinkUrl}
              onChangeText={setNewLinkUrl}
              placeholder="https://example.com/ch-{n}"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="url"
              style={[
                styles.textInputCommon,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceHighlight,
                  borderRadius: radii.controls,
                },
              ]}
            />
            <Text style={[styles.hintText, { color: colors.muted }]}>
              Use {"{n}"} where chapter/episode goes for a "Read next" button.
            </Text>

            <Text style={[styles.inputFieldLabel, { color: colors.muted, marginTop: 10 }]}>
              Name (optional)
            </Text>
            <TextInput
              selectionColor={colors.hanko}
              cursorColor={colors.hanko}
              value={newLinkLabel}
              onChangeText={setNewLinkLabel}
              placeholder="Site Name"
              placeholderTextColor={colors.muted}
              style={[
                styles.textInputCommon,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceHighlight,
                  borderRadius: radii.controls,
                },
              ]}
            />

            <View style={styles.modalActionButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => setAddLinkModalVisible(false)}
                style={[
                  styles.modalCancelBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save link"
                onPress={handleAddLink}
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor: colors.hanko,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={styles.modalSubmitBtnText}>Add link</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Details Modal */}
      <Modal
        visible={editDetailsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditDetailsVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditDetailsVisible(false)}>
          <Pressable
            style={[
              styles.modalBoxLarge,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalBoxTitle, typography.display, { color: colors.ink }]}>
                Edit Series
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setEditDetailsVisible(false)}
              >
                <Feather name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView style={styles.editDetailsScroll}>
              <Text style={[styles.inputFieldLabel, { color: colors.muted }]}>Title *</Text>
              <TextInput
                selectionColor={colors.hanko}
                cursorColor={colors.hanko}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Title"
                placeholderTextColor={colors.muted}
                style={[
                  styles.textInputCommon,
                  {
                    color: colors.ink,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls,
                  },
                ]}
              />

              <Text style={[styles.inputFieldLabel, { color: colors.muted, marginTop: 12 }]}>
                Alternative Names (comma-separated)
              </Text>
              <TextInput
                selectionColor={colors.hanko}
                cursorColor={colors.hanko}
                value={editAltNames}
                onChangeText={setEditAltNames}
                placeholder="BTTH, 斗破苍穹…"
                placeholderTextColor={colors.muted}
                style={[
                  styles.textInputCommon,
                  {
                    color: colors.ink,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls,
                  },
                ]}
              />

              <Text style={[styles.inputFieldLabel, { color: colors.muted, marginTop: 12 }]}>
                Total Chapters / Episodes
              </Text>
              <TextInput
                selectionColor={colors.hanko}
                cursorColor={colors.hanko}
                value={editTotalChapters}
                onChangeText={setEditTotalChapters}
                keyboardType="decimal-pad"
                placeholder="e.g. 100"
                placeholderTextColor={colors.muted}
                style={[
                  styles.textInputCommon,
                  {
                    color: colors.ink,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls,
                  },
                ]}
              />

              <Text style={[styles.inputFieldLabel, { color: colors.muted, marginTop: 12 }]}>
                Genres (comma-separated)
              </Text>
              <TextInput
                selectionColor={colors.hanko}
                cursorColor={colors.hanko}
                value={editGenres}
                onChangeText={setEditGenres}
                placeholder="Action, Fantasy, Romance…"
                placeholderTextColor={colors.muted}
                style={[
                  styles.textInputCommon,
                  {
                    color: colors.ink,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls,
                  },
                ]}
              />

              <Text style={[styles.inputFieldLabel, { color: colors.muted, marginTop: 12 }]}>
                Description
              </Text>
              <TextInput
                selectionColor={colors.hanko}
                cursorColor={colors.hanko}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={3}
                placeholder="What's it about?"
                placeholderTextColor={colors.muted}
                style={[
                  styles.textInputMultiline,
                  {
                    color: colors.ink,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls,
                  },
                ]}
              />
            </ScrollView>

            <View style={styles.modalActionButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => setEditDetailsVisible(false)}
                style={[
                  styles.modalCancelBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save changes"
                onPress={handleSaveDetails}
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor: colors.hanko,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={styles.modalSubmitBtnText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function PastSeasonRow({
  season,
  chapter,
  onSave,
}: {
  season: number;
  chapter: number | null;
  onSave: (chapter: number | null) => Promise<unknown>;
}) {
  const { colors, radii, typography } = useTheme();
  const [value, setValue] = useState(chapter === null ? "" : formatChapter(chapter));
  // Follow saved changes by adjusting state during render, not in an effect.
  const [shownChapter, setShownChapter] = useState(chapter);
  if (chapter !== shownChapter) {
    setShownChapter(chapter);
    setValue(chapter === null ? "" : formatChapter(chapter));
  }

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (chapter !== null) {
        try {
          await onSave(null);
        } catch (err) {
          console.error("Past season error:", err);
          setValue(formatChapter(chapter));
        }
      }
      return;
    }

    const number = Number(trimmed);
    if (Number.isFinite(number) && number >= 0 && number !== chapter) {
      try {
        await onSave(number);
      } catch (err) {
        console.error("Past season error:", err);
        setValue(chapter === null ? "" : formatChapter(chapter));
      }
      return;
    }

    setValue(chapter === null ? "" : formatChapter(chapter));
  };

  return (
    <View style={styles.pastSeasonRow}>
      <Text style={[styles.pastSeasonName, { color: colors.ink }]}>Season {season}</Text>
      <View style={styles.pastSeasonInputRow}>
        <Text style={[styles.pastSeasonEpisodeLabel, typography.number, { color: colors.muted }]}>
          last E
        </Text>
        <TextInput
          selectionColor={colors.hanko}
          cursorColor={colors.hanko}
          value={value}
          onChangeText={setValue}
          onEndEditing={() => void handleSave()}
          keyboardType="decimal-pad"
          accessibilityLabel={`Last episode watched in season ${season}`}
          placeholder="—"
          placeholderTextColor={colors.muted}
          style={[
            styles.pastSeasonInput,
            typography.number,
            {
              borderColor: colors.border,
              borderRadius: radii.controls,
              color: colors.ink,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  missingIcon: {
    marginBottom: 16,
  },
  missingTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  altNames: {
    fontSize: 14,
    marginTop: -8,
  },
  labelsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  labelTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  labelTagText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  addLabelBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 4,
  },
  addLabelBtnText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sectionCard: {
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  cardProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seasonSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  movieRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  movieStatusVal: {
    fontSize: 20,
    fontWeight: "600",
  },
  primaryActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  stepperSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  chapterTouchable: {
    flexDirection: "row",
    alignItems: "baseline",
    flex: 1,
  },
  seasonBadgeText: {
    fontSize: 20,
    fontWeight: "600",
  },
  bigChapterNumber: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "700",
  },
  bigTotalNumber: {
    fontSize: 20,
    fontWeight: "600",
  },
  chapterEditIcon: {
    marginLeft: 6,
    alignSelf: "center",
  },
  controlsCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextSeasonBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 4,
  },
  nextSeasonBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  stepBtnMinus: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPlus: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  updatedText: {
    fontSize: 12,
  },
  pastSeasonsContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  pastSeasonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pastSeasonName: {
    fontSize: 14,
  },
  pastSeasonInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pastSeasonEpisodeLabel: {
    fontSize: 13,
  },
  pastSeasonInput: {
    width: 56,
    textAlign: "center",
    borderWidth: 1,
    paddingVertical: 4,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  readNextActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 6,
  },
  readNextActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  gridTwo: {
    gap: 12,
  },
  pickerBox: {
    borderWidth: 1,
    padding: 16,
  },
  pickerBoxLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  // The chip rows scroll to the card's border; their first chip still starts on the text line.
  chipScroll: {
    flexDirection: "row",
    marginHorizontal: -16,
  },
  chipScrollContent: {
    paddingHorizontal: 16,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  choiceChipText: {
    fontSize: 13,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  genreChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smallAddLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
  },
  smallAddLinkBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyLinksText: {
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 4,
  },
  linksList: {
    gap: 8,
  },
  linkItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    padding: 10,
  },
  linkItemContent: {
    flex: 1,
    marginRight: 8,
  },
  linkBadgeAndName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkTypeTag: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  linkItemName: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  linkItemUrl: {
    fontSize: 11,
    marginTop: 2,
  },
  removeLinkBtn: {
    padding: 6,
  },
  historyList: {
    gap: 12,
    marginTop: 4,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  historyTime: {
    fontSize: 12,
  },
  emptyHistoryText: {
    fontSize: 13,
    paddingVertical: 4,
  },
  deleteSection: {
    marginTop: 12,
    alignItems: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    width: "100%",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalBoxLarge: {
    width: "100%",
    maxHeight: "85%",
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalBoxTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  chapterModalInput: {
    height: 52,
    borderWidth: 1,
    fontSize: 24,
    textAlign: "center",
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  createLabelInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  createLabelAddBtn: {
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  labelChecklist: {
    maxHeight: 260,
  },
  emptyModalText: {
    fontSize: 13,
    textAlign: "center",
    marginVertical: 16,
  },
  labelCheckItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  labelCheckItemText: {
    fontSize: 14,
    fontWeight: "500",
  },
  checkboxSmall: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  hintText: {
    fontSize: 11,
    marginTop: -8,
  },
  textInputCommon: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textInputMultiline: {
    minHeight: 80,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  editDetailsScroll: {
    maxHeight: 380,
  },
});
