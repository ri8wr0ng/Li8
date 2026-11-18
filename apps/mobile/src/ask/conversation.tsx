import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useSmoothText, useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../theme";
import { haptics } from "../haptics";
import { useTabBarInset } from "../components/glass";
import { Markdown } from "./markdown";
import { PressableScale } from "../components/pressable-scale";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

const PROMPTS = [
  "read btth up to 352",
  "what did I note about cultivation ranks?",
  "what am I reading right now?",
  "find my notes about favorite characters",
];

/** How each assistant tool reads in the UI: while running, and once done. Same wording as the web. */
const TOOLS: Record<string, { icon: FeatherName; running: string; done: string }> = {
  search: { icon: "search", running: "Searching your notes", done: "Searched your notes" },
  listLibrary: { icon: "book", running: "Checking your Library", done: "Checked your Library" },
  readNote: { icon: "book-open", running: "Reading a note", done: "Read a note" },
  updateChapter: {
    icon: "check-square",
    running: "Updating the chapter",
    done: "Updated the chapter",
  },
  addSeries: { icon: "book", running: "Adding the series", done: "Added the series" },
  createNote: { icon: "file-plus", running: "Creating a note", done: "Created a note" },
  appendToNote: { icon: "edit", running: "Adding to the note", done: "Added to the note" },
  updateNote: { icon: "edit", running: "Editing the note", done: "Edited the note" },
  updateSeries: { icon: "book", running: "Updating the series", done: "Updated the series" },
};
const toolInfo = (name: string) =>
  TOOLS[name] ?? { icon: "tool", running: "Working", done: "Used a tool" };

type ToolPart = { name: string; state?: string; output?: unknown; errorText?: string };

function toolParts(message: UIMessage): ToolPart[] {
  return message.parts.flatMap((part) => {
    const p = part as Partial<ToolPart> & { type: string; toolName?: string };
    const base = { state: p.state, output: p.output, errorText: p.errorText };
    if (p.type === "dynamic-tool") return [{ name: p.toolName ?? "", ...base }];
    if (p.type.startsWith("tool-")) return [{ name: p.type.slice(5), ...base }];
    return [];
  });
}
const isDone = (state?: string) => state === "output-available" || state === "output-error";

/** What the assistant is doing right now, or null when idle. */
function activity(messages: UIMessage[], sending: boolean): string | null {
  const last = messages.at(-1);
  if (sending || last?.role === "user") return "Thinking";
  if (!last || last.role !== "assistant") return null;
  if (last.status !== "streaming" && last.status !== "pending") return null;
  const running = toolParts(last)
    .filter((t) => !isDone(t.state))
    .pop();
  if (running) return toolInfo(running.name).running;
  return last.text ? "Writing a reply" : "Thinking";
}

export function errorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return error instanceof Error ? error.message : "Please try again.";
}

export function AskScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const status = useQuery(api.chat.status, {});
  const threads = useQuery(api.chat.threads, {});
  const remove = useMutation(api.chat.remove);
  const [threadId, setThreadId] = useState<string | undefined>();

  // "New chat" in the header, like the web's button.
  /* oxlint-disable react/no-unstable-nested-components */
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          onPress={() => setThreadId(undefined)}
          hitSlop={8}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="plus" size={22} color={colors.hanko} />
        </Pressable>
      ),
    });
  }, [navigation, colors.hanko]);
  /* oxlint-enable react/no-unstable-nested-components */

  function confirmDelete(thread: { id: string; title: string }) {
    haptics.warning();
    Alert.alert("Delete this chat?", `“${thread.title}” and its messages will be deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete chat",
        style: "destructive",
        onPress: () => {
          remove({ threadId: thread.id })
            .then(() => {
              if (threadId === thread.id) setThreadId(undefined);
            })
            .catch((error: unknown) => Alert.alert("Couldn't delete chat", errorMessage(error)));
        },
      },
    ]);
  }

  if (status?.enabled === false) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <Text style={{ color: colors.muted }}>The assistant isn't available right now.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.paper }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      {threads && threads.length > 0 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.threads}
          >
            {threads.map((thread) => {
              const active = thread.id === threadId;
              return (
                <PressableScale
                  key={thread.id}
                  onPress={() => {
                    haptics.select();
                    setThreadId(thread.id);
                  }}
                  onLongPress={() => confirmDelete(thread)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityHint="Long press to delete"
                  style={[
                    styles.thread,
                    {
                      backgroundColor: active ? colors.surfaceHighlight : colors.card,
                      borderColor: active ? colors.ink : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="message-circle"
                    size={13}
                    color={active ? colors.ink : colors.muted}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.threadText,
                      { color: active ? colors.ink : colors.muted },
                      active && styles.threadTextActive,
                    ]}
                  >
                    {thread.title}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>
      )}
      <Conversation key={threadId ?? "new"} threadId={threadId} onThread={setThreadId} />
    </KeyboardAvoidingView>
  );
}

export function Conversation({
  threadId,
  onThread,
  bottomInset,
}: {
  threadId: string | undefined;
  onThread: (id: string) => void;
  /** Space below the composer. Defaults to clearing the tab bar. */
  bottomInset?: number;
}) {
  const { colors, radii } = useTheme();
  const send = useMutation(api.chat.send);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<UIMessage>>(null);
  const tabBarInset = useTabBarInset();
  // The tab bar hides while typing, so the composer only clears it when the keyboard is down.
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const {
    results: messages,
    status,
    loadMore,
  } = useUIMessages(api.chat.messages, threadId ? { threadId } : "skip", {
    initialNumItems: 30,
    stream: true,
  });
  const working = activity(messages, sending);

  async function submit(text = prompt.trim()) {
    if (!text || sending) return;
    haptics.tap();
    setSending(true);
    try {
      const id = await send({ prompt: text, ...(threadId ? { threadId } : {}) });
      setPrompt("");
      if (id !== threadId) onThread(id);
    } catch (error) {
      Alert.alert("Couldn't send", errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.flex}>
      {threadId && messages.length === 0 && status === "LoadingFirstPage" ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.hanko} />
        </View>
      ) : messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.empty} keyboardShouldPersistTaps="handled">
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHighlight }]}>
            <Feather name="zap" size={20} color={colors.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>What would you like to do?</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>
            Ask about your notes, update a chapter, or look something up.
          </Text>
          <View style={styles.prompts}>
            {PROMPTS.map((example) => (
              <PressableScale
                key={example}
                onPress={() => setPrompt(example)}
                style={[
                  styles.promptChip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={[styles.promptText, { color: colors.muted }]}>{example}</Text>
              </PressableScale>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.key}
          renderItem={({ item }) => <ChatMessage message={item} />}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            status === "CanLoadMore" ? (
              <Pressable onPress={() => loadMore(30)} style={styles.loadMore}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Load earlier messages</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}

      <View
        style={[
          styles.composerWrap,
          { paddingBottom: keyboardUp ? 4 : (bottomInset ?? tabBarInset) },
        ]}
      >
        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.card,
              borderColor: working ? colors.hanko : colors.border,
              borderRadius: radii.card,
            },
          ]}
        >
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ask about your notes or Library…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={4000}
            accessibilityLabel="Message"
            style={[styles.input, { color: colors.ink }]}
          />
          <PressableScale
            onPress={() => void submit()}
            disabled={!prompt.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            scale={0.9}
            style={[
              styles.send,
              {
                backgroundColor: colors.hanko,
                borderRadius: radii.controls,
                opacity: !prompt.trim() || sending ? 0.4 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="arrow-up" size={18} color="#fff" />
            )}
          </PressableScale>
        </View>
        <View style={styles.statusLine} accessibilityLiveRegion="polite">
          {working && (
            <>
              <Feather name="zap" size={12} color={colors.muted} />
              <Text style={[styles.statusText, { color: colors.muted }]}>{working}…</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function ChatMessage({ message }: { message: UIMessage }) {
  const { colors } = useTheme();

  if (message.role === "user") {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: colors.surfaceHighlight }]}>
          <Text selectable style={[styles.userText, { color: colors.ink }]}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  const streaming = message.status === "streaming" || message.status === "pending";
  const tools = toolParts(message);
  return (
    <View style={styles.assistant}>
      {tools.length > 0 && (
        <View style={styles.tools}>
          {tools.map((tool, i) => (
            <ToolStep key={`${message.key}-tool-${i}`} tool={tool} streaming={streaming} />
          ))}
        </View>
      )}
      {message.parts.map((part, i) =>
        part.type === "text" && part.text ? (
          <SmoothPart key={`${message.key}-${i}`} text={part.text} streaming={streaming} />
        ) : null,
      )}
      {message.status === "failed" && (
        <Text style={{ color: colors.destructive, fontSize: 14 }}>
          The assistant couldn't finish this reply. Try again.
        </Text>
      )}
    </View>
  );
}

function ToolStep({ tool, streaming }: { tool: ToolPart; streaming: boolean }) {
  const { colors } = useTheme();
  const info = toolInfo(tool.name);
  const failed = tool.state === "output-error" || (!isDone(tool.state) && !streaming);
  const label = !isDone(tool.state)
    ? streaming
      ? `${info.running}…`
      : `Couldn't finish: ${info.running.toLowerCase()}`
    : failed
      ? `Failed: ${info.running.toLowerCase()}`
      : info.done;
  const title =
    typeof tool.output === "object" && tool.output !== null && "title" in tool.output
      ? tool.output.title
      : null;
  const detail = typeof title === "string" ? title : null;

  return (
    <View style={styles.tool}>
      {!isDone(tool.state) && streaming ? (
        <ActivityIndicator size="small" color={colors.muted} style={styles.toolSpinner} />
      ) : (
        <Feather name={info.icon} size={13} color={failed ? colors.destructive : colors.muted} />
      )}
      <Text
        numberOfLines={1}
        style={[styles.toolText, { color: failed ? colors.destructive : colors.muted }]}
      >
        {label}
        {detail ? ` · ${detail}` : ""}
      </Text>
    </View>
  );
}

function SmoothPart({ text, streaming }: { text: string; streaming: boolean }) {
  const [visible] = useSmoothText(text, { startStreaming: streaming });
  return <Markdown text={visible} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  headerBtn: { paddingHorizontal: 16 },
  threads: { gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  thread: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 34,
    maxWidth: 220,
  },
  threadText: { fontSize: 13, flexShrink: 1 },
  threadTextActive: { fontWeight: "600" },
  empty: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 16, fontSize: 19, fontWeight: "600", letterSpacing: -0.3 },
  emptyBody: { marginTop: 6, fontSize: 14, textAlign: "center" },
  prompts: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  promptChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  promptText: { fontSize: 13 },
  messages: { padding: 16, gap: 20 },
  loadMore: { alignSelf: "center", padding: 8 },
  userRow: { alignItems: "flex-end" },
  userBubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { fontSize: 15, lineHeight: 22 },
  assistant: { gap: 10 },
  tools: { gap: 6 },
  tool: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolSpinner: { transform: [{ scale: 0.7 }], width: 13, height: 13 },
  toolText: { fontSize: 13, flexShrink: 1 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 6 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 140, paddingVertical: 8 },
  send: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingHorizontal: 4,
  },
  statusText: { fontSize: 12, fontWeight: "500" },
});
