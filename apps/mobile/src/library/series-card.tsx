import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { PressableScale } from "../components/pressable-scale";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../theme";
import { haptics } from "../haptics";
import {
  formatChapter,
  isEpisodic,
  isWatchKind,
  KIND_LABEL,
  nextReadUrl,
  progressLabel,
  statusLabel,
} from "./series";
import { relativeTime } from "./time";

interface SeriesCardProps {
  series: Doc<"series">;
  labelsMap?: Map<string, string>;
}

export function SeriesCard({ series, labelsMap }: SeriesCardProps) {
  const router = useRouter();
  const { colors, radii, typography } = useTheme();

  const bump = useMutation(api.series.bump);
  const update = useMutation(api.series.update);
  const setChapter = useMutation(api.series.setChapter);

  const [isBumping, setIsBumping] = useState(false);

  const episodic = isEpisodic(series.kind);
  const isMovie = series.kind === "movie";
  const next = series.chapter + 1;
  const nextUrl = nextReadUrl(series, next);
  const progress = series.totalChapters ? Math.min(1, series.chapter / series.totalChapters) : null;

  const handlePressCard = () => {
    router.push({
      pathname: "/library/[seriesId]",
      params: { seriesId: series._id },
    });
  };

  const handleBumpPlus = async (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (isBumping) return;
    haptics.tap();
    setIsBumping(true);
    try {
      await bump({ id: series._id, delta: 1 });
    } catch (err) {
      console.error("Bump error:", err);
    } finally {
      setIsBumping(false);
    }
  };

  const handleBumpMinus = async (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (isBumping || series.chapter <= 0) return;
    haptics.tap();
    setIsBumping(true);
    try {
      await bump({ id: series._id, delta: -1 });
    } catch (err) {
      console.error("Bump minus error:", err);
    } finally {
      setIsBumping(false);
    }
  };

  const handleMarkWatched = async (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    haptics.success();
    try {
      await update({ id: series._id, status: "completed" });
    } catch (err) {
      console.error("Mark watched error:", err);
    }
  };

  const handleReadNext = async (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (!nextUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(nextUrl);
      if (canOpen) {
        await WebBrowser.openBrowserAsync(nextUrl).catch(() => Linking.openURL(nextUrl));
      }
    } catch {
      // Fallback open
      void Linking.openURL(nextUrl);
    }
    // Update progress to next
    void setChapter({ id: series._id, chapter: next });
  };

  const seriesLabels =
    series.labelIds && labelsMap
      ? series.labelIds
          .map((id) => labelsMap.get(id))
          .filter((name): name is string => Boolean(name))
      : [];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open series ${series.title}`}
      onPress={handlePressCard}
      scale={0.98}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radii.card,
        },
      ]}
    >
      {/* Header: Kind, Status, Chevron */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <Text style={[styles.kindBadge, { color: colors.muted }]}>
            {KIND_LABEL[series.kind].toUpperCase()}
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.border }]} />
          <Text style={[styles.statusBadge, { color: colors.muted }]}>
            {statusLabel(series.status, series.kind).toUpperCase()}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </View>

      {/* Title */}
      <Text style={[styles.title, typography.display, { color: colors.ink }]} numberOfLines={2}>
        {series.title}
      </Text>

      {/* Alternative Names */}
      {series.altNames && series.altNames.length > 0 ? (
        <Text
          style={[styles.altNames, typography.bodySm, { color: colors.muted }]}
          numberOfLines={1}
        >
          {series.altNames.join(" · ")}
        </Text>
      ) : null}

      {/* Labels */}
      {seriesLabels.length > 0 ? (
        <View style={styles.labelRow}>
          {seriesLabels.map((name, index) => (
            <View
              key={`${name}-${index}`}
              style={[
                styles.labelPill,
                {
                  backgroundColor: colors.surfaceHighlight,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.labelText, { color: colors.muted }]}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Progress & Controls */}
      {isMovie ? (
        <View style={styles.footerRow}>
          <Text style={[styles.updatedText, { color: colors.muted }]}>
            {relativeTime(series.lastReadAt)}
          </Text>
          {series.status !== "completed" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark watched"
              onPress={handleMarkWatched}
              style={({ pressed }) => [
                styles.markWatchedButton,
                {
                  backgroundColor: colors.hanko,
                  borderRadius: radii.controls,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Text style={[styles.markWatchedText, { color: colors.card }]}>Mark watched</Text>
            </Pressable>
          ) : (
            <Text style={[styles.watchedText, { color: colors.muted }]}>Watched</Text>
          )}
        </View>
      ) : (
        <View style={styles.progressRow}>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressTypeLabel, { color: colors.muted }]}>
              {episodic ? "EPISODE" : "CHAPTER"}
            </Text>
            <View style={styles.chapterNumbers}>
              {episodic && (
                <Text style={[styles.seasonText, typography.number, { color: colors.muted }]}>
                  S{series.season ?? 1} ·{" "}
                </Text>
              )}
              <Text style={[styles.chapterValue, typography.number, { color: colors.ink }]}>
                {formatChapter(series.chapter)}
              </Text>
              {series.totalChapters ? (
                <Text
                  style={[styles.totalChapterValue, typography.number, { color: colors.muted }]}
                >
                  {" "}
                  / {formatChapter(series.totalChapters)}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.updatedText, { color: colors.muted }]}>
              {relativeTime(series.lastReadAt)}
            </Text>
          </View>

          {/* Stepper buttons */}
          <View style={styles.stepperContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`One back on ${series.title}`}
              disabled={series.chapter <= 0 || isBumping}
              onPress={handleBumpMinus}
              style={({ pressed }) => [
                styles.stepMinusButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: series.chapter <= 0 ? 0.35 : pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                },
              ]}
            >
              <Feather name="minus" size={16} color={colors.ink} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`One forward on ${series.title}`}
              disabled={isBumping}
              onPress={handleBumpPlus}
              style={({ pressed }) => [
                styles.stepPlusButton,
                {
                  backgroundColor: colors.hanko,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Read Next Link Button */}
      {nextUrl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isWatchKind(series.kind) ? "Watch" : "Read"} next`}
          onPress={handleReadNext}
          style={({ pressed }) => [
            styles.readNextButton,
            {
              backgroundColor: colors.surfaceHighlight,
              borderRadius: radii.controls,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.readNextText, { color: colors.ink }]}>
            {isWatchKind(series.kind) ? "Watch" : "Read"}{" "}
            {episodic
              ? `S${series.season ?? 1} · E${formatChapter(next)}`
              : `${progressLabel(series.kind)} ${formatChapter(next)}`}
          </Text>
          <Feather name="external-link" size={14} color={colors.muted} />
        </Pressable>
      ) : null}

      {/* Progress Bar */}
      {progress !== null && !isMovie ? (
        <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: colors.hanko,
              },
            ]}
          />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  kindBadge: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 6,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 4,
  },
  altNames: {
    fontSize: 13,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 6,
  },
  labelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "500",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 12,
  },
  progressInfo: {
    flex: 1,
  },
  progressTypeLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  chapterNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  seasonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  chapterValue: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
  },
  totalChapterValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  updatedText: {
    fontSize: 12,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepMinusButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPlusButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  markWatchedButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  markWatchedText: {
    fontSize: 13,
    fontWeight: "600",
  },
  watchedText: {
    fontSize: 13,
    fontWeight: "500",
  },
  readNextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 6,
    marginTop: 14,
  },
  readNextText: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressBarTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressBarFill: {
    height: "100%",
  },
});
