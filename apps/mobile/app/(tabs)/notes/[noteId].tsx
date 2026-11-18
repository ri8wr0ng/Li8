import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc, Id } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../../../src/theme";
import { ChipInput } from "../../../src/notes/chip-input";
import { EmptyState } from "../../../src/notes/empty-state";
import { relativeTime } from "../../../src/notes/time";

type SaveState = "saved" | "saving" | "error";

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
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
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

  return <Editor note={note} />;
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

function Editor({ note }: { note: Doc<"notes"> }) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags);

  const bodyInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const titleInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const save = useAutosave(note._id);
  const updateNote = useMutation(api.notes.update);
  const removeNote = useMutation(api.notes.remove);

  // Sync external changes when server copy updates, unless local edits are in flight
  /* oxlint-disable react/exhaustive-effect-dependencies, react-hooks/exhaustive-deps, react/set-state-in-effect */
  useEffect(() => {
    if (save.isDirty()) return;
    setTitle(note.title);
    setBody(note.body);
    setTags(note.tags);
  }, [note.updatedAt]);
  /* oxlint-enable react/exhaustive-effect-dependencies, react-hooks/exhaustive-deps, react/set-state-in-effect */

  // Hide parent tab navigation header when inside editor
  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({
      headerShown: false,
    });
    return () => {
      parent?.setOptions({
        headerShown: true,
      });
    };
  }, [navigation]);

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
    try {
      await updateNote({ id: note._id, pinned: !note.pinned });
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleDelete = () => {
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
              console.error("Failed to delete note:", err);
            }
          },
        },
      ],
    );
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
            <Feather name="bookmark" size={20} color={note.pinned ? colors.hanko : colors.muted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete note"
            hitSlop={8}
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.toolbarBtn,
              {
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="trash-2" size={20} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom, 24) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
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
              onChange={handleTagsChange}
              placeholder={tags.length ? "Add tag" : "Add tags…"}
            />
          </View>

          {/* Body */}
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
            style={[
              styles.bodyInput,
              typography.body,
              {
                color: colors.ink,
              },
            ]}
          />

          {/* Footer Metadata */}
          <Text style={[styles.metaText, { color: colors.muted }]}>
            {words} {words === 1 ? "word" : "words"} · Edited {relativeTime(note.updatedAt)}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
