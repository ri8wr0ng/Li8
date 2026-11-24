import { StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { PressableScale } from "../components/pressable-scale";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import { markdownToPlainText } from "@inkmark/editor/plain-text";
import { useTheme } from "../theme";
import { HighlightedText } from "./highlight";
import { snippet } from "./snippet";
import { relativeTime } from "./time";
import { SwipeRow, type SwipeAction } from "../components/swipe-row";
import { haptics } from "../haptics";
import { dialog } from "../components/dialog";

async function runMutation(label: string, action: () => Promise<unknown>) {
  try {
    await action();
  } catch (err) {
    haptics.warning();
    console.error(`${label}:`, err);
  }
}

export function NoteCard({
  note,
  terms = [],
  query,
  subtitle,
  swipeable = true,
}: {
  note: Doc<"notes">;
  terms?: string[];
  query?: string;
  subtitle?: string;
  swipeable?: boolean;
}) {
  const router = useRouter();
  const { colors, radii, typography } = useTheme();
  const me = useQuery(api.users.me, {});
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);
  const setArchived = useMutation(api.notes.setArchived);
  const unshare = useMutation(api.notes.unshare);
  const isOwner = me?.id === note.userId;

  const handlePress = () => {
    router.push({
      pathname: "/(tabs)/notes/[noteId]",
      params: {
        noteId: note._id,
        ...(query ? { q: query } : {}),
      },
    });
  };

  const plainBody = markdownToPlainText(note.body);
  const bodySnippet = plainBody ? snippet(plainBody, terms, 90) : "";

  const leading: SwipeAction[] =
    isOwner && note.archived !== true
      ? [
          {
            key: "pin",
            label: note.pinned ? "Unpin" : "Pin",
            icon: "bookmark",
            color: colors.hanko,
            onPress: () =>
              void runMutation("Failed to toggle pin", () =>
                updateNote({ id: note._id, pinned: !note.pinned }),
              ),
          },
        ]
      : [];

  const trailing: SwipeAction[] = isOwner
    ? [
        {
          key: note.archived === true ? "restore" : "archive",
          label: note.archived === true ? "Restore" : "Archive",
          icon: note.archived === true ? "rotate-ccw" : "archive",
          color: colors.muted,
          onPress: () =>
            void runMutation("Failed to update archive", () =>
              setArchived({ id: note._id, archived: note.archived !== true }),
            ),
        },
        {
          key: "delete",
          label: "Delete",
          icon: "trash-2",
          color: colors.destructive,
          destructive: true,
          onPress: () => {
            haptics.warning();
            dialog.alert(
              "Delete this note?",
              `“${note.title.trim() || "Untitled"}” will be removed from all your devices. This can't be undone.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    runMutation("Failed to delete note", () => removeNote({ id: note._id })),
                },
              ],
            );
          },
        },
      ]
    : [
        {
          key: "leave",
          label: "Leave",
          icon: "log-out",
          color: colors.muted,
          onPress: () => {
            if (!me) return;
            void runMutation("Failed to leave shared note", () =>
              unshare({ id: note._id, userId: me.id }),
            );
          },
        },
      ];

  return (
    <SwipeRow
      leading={swipeable ? leading : []}
      trailing={swipeable ? trailing : []}
      borderRadius={radii.card}
      spacing={10}
      accessibilityLabel={note.title.trim() || "Untitled note"}
      onAccessibilityTap={handlePress}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={note.title.trim() || "Untitled note"}
        onPress={handlePress}
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
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            {note.pinned && (
              <Feather
                name="bookmark"
                size={14}
                color={colors.hanko}
                style={styles.pinIcon}
                accessibilityLabel="Pinned"
              />
            )}
            {note.title ? (
              <HighlightedText
                text={note.title}
                terms={terms}
                numberOfLines={1}
                style={[
                  styles.title,
                  typography.display,
                  {
                    color: colors.ink,
                  },
                ]}
              />
            ) : (
              <Text style={[styles.untitled, { color: colors.muted }]}>Untitled</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.time, { color: colors.muted }]}>
              {relativeTime(note.updatedAt)}
            </Text>
            {note.archived === true && (
              <Text
                style={[
                  styles.archivedBadge,
                  {
                    color: colors.muted,
                    backgroundColor: colors.paper,
                  },
                ]}
              >
                Archived
              </Text>
            )}
          </View>
        </View>

        {bodySnippet ? (
          <HighlightedText
            text={bodySnippet}
            terms={terms}
            numberOfLines={2}
            style={[styles.snippet, typography.bodySm, { color: colors.muted }]}
          />
        ) : null}

        {note.tags.length > 0 && (
          <View style={styles.tagList}>
            {note.tags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tagBadge,
                  {
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: radii.controls / 2,
                  },
                ]}
              >
                <Text style={[styles.tagHash, { color: colors.muted }]}>#</Text>
                <HighlightedText
                  text={tag}
                  terms={terms}
                  style={[styles.tagText, { color: colors.ink }]}
                />
              </View>
            ))}
          </View>
        )}

        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
        ) : null}
      </PressableScale>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  pinIcon: {
    marginRight: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  untitled: {
    fontSize: 16,
    fontStyle: "italic",
  },
  time: {
    fontSize: 12,
    flexShrink: 0,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  archivedBadge: {
    fontSize: 11,
    fontWeight: "600",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 6,
  },
  snippet: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagHash: {
    fontSize: 11,
    fontWeight: "500",
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
