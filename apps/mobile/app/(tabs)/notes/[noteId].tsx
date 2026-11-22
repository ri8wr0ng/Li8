import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc, Id } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../../../src/theme";
import { haptics } from "../../../src/haptics";
import { useTabBarInset } from "../../../src/components/glass";
import { ChipInput } from "../../../src/notes/chip-input";
import { EmptyState } from "../../../src/notes/empty-state";
import { relativeTime } from "../../../src/notes/time";
import { ShareSheet } from "../../../src/notes/share-sheet";

type SaveState = "saved" | "saving" | "error";

/** Long enough for the actions sheet to finish closing before another modal or alert opens. */
const MODAL_CLOSE_MS = 350;

function useAutosave(id: Id<"notes">) {
  const update = useMutation(api.notes.update);
  const pending = useRef<{ title?: string; body?: string; tags?: string[] }>({});
  const inFlight = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [state, setState] = useState<SaveState>("saved");

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    inFlight.current++;
    try {
      await update({ id, ...patch });
      inFlight.current--;
      if (inFlight.current === 0 && Object.keys(pending.current).length === 0) {
        setState("saved");
      }
    } catch (err) {
      inFlight.current--;
      console.error("Autosave error:", err);
      pending.current = { ...patch, ...pending.current };
      setState("error");
    }
  }, [id, update]);

  const queue = useCallback(
    (patch: typeof pending.current, delay = 600) => {
      Object.assign(pending.current, patch);
      setState("saving");
      clearTimeout(timer.current);
      if (delay === 0) {
        void flush();
      } else {
        timer.current = setTimeout(() => void flush(), delay);
      }
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  const isDirty = () => Object.keys(pending.current).length > 0 || inFlight.current > 0;
  return { state, queue, flush, isDirty };
}

export default function NoteDetailScreen() {
  const { noteId, q } = useLocalSearchParams<{ noteId: string; q?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // If noteId is missing or empty, handle gracefully
  const note = useQuery(
    api.notes.get,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    noteId ? { id: noteId as Id<"notes"> } : "skip",
  );

  if (note === undefined) {
    return (
      <View
        style={[
          styles.centerContainer,
          {
            backgroundColor: colors.paper,
            paddingTop: insets.top,
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.hanko} />
      </View>
    );
  }

  if (note === null) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.paper,
            paddingTop: insets.top,
          },
        ]}
      >
        <NotFoundView />
      </View>
    );
  }

  return <Editor key={note._id} note={note} initialFind={q} />;
}

function NotFoundView() {
  const router = useRouter();
  const { colors, radii } = useTheme();

  return (
    <EmptyState
      icon={<Feather name="alert-circle" size={28} color={colors.muted} />}
      title="This note isn't here"
      description="It may have been deleted on another device."
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to notes"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            {
              borderColor: colors.border,
              borderRadius: radii.controls,
              backgroundColor: colors.card,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.backBtnText, { color: colors.ink }]}>Back to notes</Text>
        </Pressable>
      }
    />
  );
}

function Editor({ note, initialFind }: { note: Doc<"notes">; initialFind?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const { colors, typography, radii } = useTheme();

  const access = useQuery(api.notes.access, { id: note._id });
  const me = useQuery(api.users.me);
  const role = access?.role ?? "owner";
  const isOwner = role === "owner";
  const readOnly = role === "view";

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags);
  const [findOpen, setFindOpen] = useState(Boolean(initialFind));
  const [find, setFind] = useState(initialFind ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [bodyY, setBodyY] = useState(0);
  const [measureHeight, setMeasureHeight] = useState(0);

  const bodyInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const titleInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const save = useAutosave(note._id);
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);
  const duplicate = useMutation(api.notes.duplicate);
  const setArchived = useMutation(api.notes.setArchived);
  const unshare = useMutation(api.notes.unshare);

  const matches = useMemo(() => {
    if (!find) return [];
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escaped, "gi");
    const found: { start: number; end: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = expression.exec(body)) !== null) {
      found.push({ start: match.index, end: match.index + match[0].length });
    }
    return found;
  }, [body, find]);

  const currentActiveIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));

  useEffect(() => {
    if (findOpen && find && matches.length > 0 && currentActiveIndex >= 0 && measureHeight > 0) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, bodyY + measureHeight - 160),
        animated: true,
      });
    }
  }, [bodyY, currentActiveIndex, find, findOpen, matches.length, measureHeight]);

  // Sync external changes when server copy updates, unless local edits are in flight
  /* oxlint-disable react/exhaustive-effect-dependencies, react-hooks/exhaustive-deps, react/set-state-in-effect */
  useEffect(() => {
    if (save.isDirty()) return;
    setTitle(note.title);
    setBody(note.body);
    setTags(note.tags);
  }, [note.updatedAt]);
  /* oxlint-enable react/exhaustive-effect-dependencies, react-hooks/exhaustive-deps, react/set-state-in-effect */

  const handleBack = useCallback(async () => {
    await save.flush();
    router.back();
  }, [router, save]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    save.queue({ title: val });
  };

  const handleBodyChange = (val: string) => {
    setBody(val);
    save.queue({ body: val });
  };

  const handleTagsChange = (next: string[]) => {
    setTags(next);
    save.queue({ tags: next }, 0);
  };

  const togglePin = async () => {
    haptics.select();
    try {
      await updateNote({ id: note._id, pinned: !note.pinned });
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleDelete = () => {
    haptics.warning();
    Alert.alert(
      "Delete this note?",
      `“${title.trim() || "Untitled"}” will be removed from all your devices. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeNote({ id: note._id });
              router.back();
            } catch (err) {
              Alert.alert(
                "Couldn't do that",
                err instanceof ConvexError ? String(err.data) : "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const runMenuAction = (action: () => Promise<void>) => {
    setActionsOpen(false);
    void action().catch((err: unknown) => {
      Alert.alert(
        "Couldn't do that",
        err instanceof ConvexError ? String(err.data) : "Please try again.",
      );
    });
  };

  const stepMatch = (direction: -1 | 1) => {
    if (matches.length === 0) return;
    setActiveIndex(
      (current) =>
        (Math.min(current, matches.length - 1) + direction + matches.length) % matches.length,
    );
    haptics.select();
  };

  const activeStart = matches[currentActiveIndex]?.start ?? 0;
  const highlightedBody = useMemo(() => {
    if (!find || matches.length === 0) return body;
    const segments: React.ReactNode[] = [];
    let cursor = 0;
    matches.forEach((match, index) => {
      if (match.start > cursor) segments.push(body.slice(cursor, match.start));
      segments.push(
        <Text
          key={`match-${match.start}`}
          style={{
            backgroundColor: index === currentActiveIndex ? colors.markerActive : colors.marker,
          }}
        >
          {body.slice(match.start, match.end)}
        </Text>,
      );
      cursor = match.end;
    });
    if (cursor < body.length) segments.push(body.slice(cursor));
    return segments;
  }, [body, colors.marker, colors.markerActive, currentActiveIndex, find, matches]);

  const bodyTextStyle = [styles.bodyInput, typography.body, { color: colors.ink }];
  const openBodyEditor = () => {
    setFindOpen(false);
    requestAnimationFrame(() => bodyInputRef.current?.focus());
  };

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      {/* Top Toolbar */}
      <View
        style={[
          styles.toolbar,
          {
            paddingTop: Math.max(insets.top, 12),
            borderBottomColor: colors.border,
            backgroundColor: colors.paper,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to notes"
          hitSlop={8}
          onPress={handleBack}
          style={({ pressed }) => [
            styles.toolbarBtn,
            {
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </Pressable>

        <SaveIndicator state={save.state} onRetry={() => void save.flush()} />

        <View style={styles.toolbarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find in note"
            hitSlop={8}
            onPress={() => setFindOpen(true)}
            style={({ pressed }) => [styles.toolbarBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="search" size={20} color={colors.muted} />
          </Pressable>

          {isOwner && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={note.pinned ? "Unpin" : "Pin to top"}
              accessibilityState={{ selected: note.pinned }}
              hitSlop={8}
              onPress={togglePin}
              style={({ pressed }) => [
                styles.toolbarBtn,
                {
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Feather
                name="bookmark"
                size={20}
                color={note.pinned ? colors.hanko : colors.muted}
              />
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More actions"
            hitSlop={8}
            onPress={() => setActionsOpen(true)}
            style={({ pressed }) => [
              styles.toolbarBtn,
              {
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="more-horizontal" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      {role !== "owner" && (
        <Text style={[styles.sharedPill, { color: colors.muted }]}>
          Shared by {access?.ownerName ?? "someone"} · {role === "edit" ? "Can edit" : "View only"}
        </Text>
      )}

      {findOpen && (
        <View
          style={[
            styles.findBar,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: radii.controls,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            value={find}
            onChangeText={(value) => {
              setFind(value);
              setActiveIndex(0);
            }}
            autoFocus={!initialFind}
            placeholder="Find in note"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => stepMatch(1)}
            blurOnSubmit={false}
            style={[styles.findInput, { color: colors.ink }]}
          />
          <Text style={[styles.findCounter, { color: colors.muted }]}>
            {find && matches.length === 0
              ? "No matches"
              : matches.length
                ? `${currentActiveIndex + 1}/${matches.length}`
                : ""}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous match"
            disabled={!matches.length}
            onPress={() => stepMatch(-1)}
            style={{ opacity: matches.length ? 1 : 0.35 }}
          >
            <Feather name="chevron-up" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next match"
            disabled={!matches.length}
            onPress={() => stepMatch(1)}
            style={{ opacity: matches.length ? 1 : 0.35 }}
          >
            <Feather name="chevron-down" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close find"
            onPress={() => setFindOpen(false)}
          >
            <Feather name="x" size={18} color={colors.muted} />
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: tabBarInset + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {note.archived && isOwner && (
            <View
              style={[
                styles.archivedBanner,
                {
                  backgroundColor: colors.paper,
                  borderColor: colors.border,
                  borderRadius: radii.controls,
                },
              ]}
            >
              <Feather name="archive" size={16} color={colors.muted} />
              <Text style={[styles.archivedText, { color: colors.muted }]}>
                This note is archived.
              </Text>
              <Pressable
                onPress={() =>
                  runMenuAction(async () => {
                    await setArchived({ id: note._id, archived: false });
                  })
                }
              >
                <Text style={[styles.unarchiveText, { color: colors.hanko }]}>Unarchive</Text>
              </Pressable>
            </View>
          )}
          {/* Title */}
          <TextInput
            ref={titleInputRef}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Untitled"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Title"
            returnKeyType="next"
            onSubmitEditing={() => bodyInputRef.current?.focus()}
            editable={!readOnly}
            style={[
              styles.titleInput,
              typography.display,
              {
                color: colors.ink,
              },
            ]}
          />

          {/* Tags */}
          <View style={styles.tagSection}>
            <ChipInput
              value={tags}
              onChange={readOnly ? () => undefined : handleTagsChange}
              placeholder={tags.length ? "Add tag" : "Add tags…"}
            />
          </View>

          {/* Body */}
          <View style={styles.bodyWrap} onLayout={(event) => setBodyY(event.nativeEvent.layout.y)}>
            {findOpen && find ? (
              <Pressable onPress={openBodyEditor}>
                <Text style={bodyTextStyle}>{highlightedBody}</Text>
              </Pressable>
            ) : (
              <TextInput
                ref={bodyInputRef}
                value={body}
                onChangeText={handleBodyChange}
                placeholder="Start writing…"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Note body"
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                editable={!readOnly}
                style={bodyTextStyle}
              />
            )}
            {findOpen && find && matches.length > 0 && (
              <Text
                pointerEvents="none"
                onLayout={(event) => setMeasureHeight(event.nativeEvent.layout.height)}
                style={[bodyTextStyle, styles.measureText]}
              >
                {body.slice(0, activeStart)}
                {"\u200B"}
              </Text>
            )}
          </View>

          {/* Footer Metadata */}
          <Text style={[styles.metaText, { color: colors.muted }]}>
            {words} {words === 1 ? "word" : "words"} · Edited {relativeTime(note.updatedAt)}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={actionsOpen}
        onRequestClose={() => setActionsOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActionsOpen(false)} />
          <View style={[styles.actionSheet, { backgroundColor: colors.card, borderRadius: 16 }]}>
            {isOwner && (
              <ActionRow
                icon="share-2"
                label="Share…"
                colors={colors}
                onPress={() => {
                  setActionsOpen(false);
                  // iOS can't present a second modal until this one has closed.
                  setTimeout(() => setShareOpen(true), MODAL_CLOSE_MS);
                }}
              />
            )}
            <ActionRow
              icon="copy"
              label="Make a copy"
              colors={colors}
              onPress={() =>
                runMenuAction(async () => {
                  await save.flush();
                  const id = await duplicate({ id: note._id });
                  haptics.success();
                  router.replace({ pathname: "/(tabs)/notes/[noteId]", params: { noteId: id } });
                })
              }
            />
            {isOwner && (
              <ActionRow
                icon={note.archived ? "rotate-ccw" : "archive"}
                label={note.archived ? "Unarchive" : "Archive"}
                colors={colors}
                onPress={() =>
                  runMenuAction(async () => {
                    await setArchived({ id: note._id, archived: !note.archived });
                    if (!note.archived) router.back();
                  })
                }
              />
            )}
            {!isOwner && (
              <ActionRow
                icon="log-out"
                label="Leave shared note"
                colors={colors}
                onPress={() =>
                  runMenuAction(async () => {
                    if (!me) throw new Error("Please try again.");
                    await unshare({ id: note._id, userId: me.id });
                    router.back();
                  })
                }
              />
            )}
            {isOwner && (
              <ActionRow
                icon="trash-2"
                label="Delete note"
                colors={colors}
                destructive
                onPress={() => {
                  setActionsOpen(false);
                  setTimeout(handleDelete, MODAL_CLOSE_MS);
                }}
              />
            )}
          </View>
          <Pressable
            style={[
              styles.cancelCard,
              { backgroundColor: colors.card, marginTop: 8, marginBottom: insets.bottom + 12 },
            ]}
            onPress={() => setActionsOpen(false)}
          >
            <Text style={[styles.cancelText, { color: colors.ink }]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
      <ShareSheet noteId={note._id} visible={shareOpen} onClose={() => setShareOpen(false)} />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  colors,
  onPress,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { borderBottomColor: colors.border, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Feather name={icon} size={18} color={destructive ? colors.destructive : colors.ink} />
      <Text style={[styles.actionLabel, { color: destructive ? colors.destructive : colors.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const { colors } = useTheme();

  if (state === "error") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Couldn't save · Retry"
        onPress={onRetry}
        style={styles.saveIndicator}
      >
        <Text style={[styles.errorText, { color: colors.destructive }]}>Couldn't save · Retry</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.saveIndicator}>
      <View
        style={[
          styles.saveDot,
          {
            backgroundColor: state === "saving" ? colors.markerActive : "#10B981",
          },
        ]}
      />
      <Text style={[styles.saveText, { color: colors.muted }]}>
        {state === "saving" ? "Saving…" : "Saved"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 8,
  },
  saveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    gap: 6,
  },
  saveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  saveText: {
    fontSize: 12,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sharedPill: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  findBar: {
    height: 44,
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  findInput: { flex: 1, paddingVertical: 0, fontSize: 15 },
  findCounter: { fontSize: 12, fontVariant: ["tabular-nums"] },
  archivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  archivedText: { flex: 1, fontSize: 14 },
  unarchiveText: { fontSize: 14, fontWeight: "600" },
  bodyWrap: { position: "relative" },
  measureText: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    minHeight: 0,
    paddingVertical: 12,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  actionSheet: { marginHorizontal: 12, overflow: "hidden" },
  actionRow: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { fontSize: 16 },
  cancelCard: {
    height: 52,
    marginHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 16, fontWeight: "600" },
  titleInput: {
    fontSize: 26,
    fontWeight: "700",
    paddingVertical: 8,
    paddingHorizontal: 0,
    letterSpacing: -0.5,
  },
  tagSection: {
    marginVertical: 10,
  },
  bodyInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 240,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  metaText: {
    marginTop: 24,
    fontSize: 12,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
