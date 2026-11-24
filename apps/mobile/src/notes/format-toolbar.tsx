import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Alignment, EditorCommand, EditorToolbarState, HeadingLevel } from "@inkmark/editor";
import { useState, type ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { haptics } from "../haptics";
import { useTheme } from "../theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type Mode = "main" | "heading" | "align";

const HEADING_SHORT: Record<0 | HeadingLevel, string> = {
  0: "Aa",
  1: "H1",
  2: "H2",
  3: "H3",
  4: "H4",
  5: "H5",
  6: "H6",
};

const ALIGN: { value: Alignment; icon: IconName; label: string }[] = [
  { value: "left", icon: "format-align-left", label: "Align left" },
  { value: "center", icon: "format-align-center", label: "Center" },
  { value: "right", icon: "format-align-right", label: "Align right" },
  { value: "justify", icon: "format-align-justify", label: "Justify" },
];

/** The formatting bar that sits above the keyboard while the note body is focused. */
export function FormatToolbar({
  state,
  onCommand,
}: {
  state: EditorToolbarState;
  onCommand: (command: EditorCommand) => void;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>("main");
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");

  const run = (command: EditorCommand) => {
    haptics.select();
    onCommand(command);
  };

  const alignIcon = ALIGN.find((a) => a.value === state.align)?.icon ?? "format-align-left";

  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      <ScrollView
        key={mode}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.row}
      >
        {mode === "main" && (
          <>
            <Tool
              icon="undo"
              label="Undo"
              disabled={!state.canUndo}
              onPress={() => run({ type: "undo" })}
            />
            <Tool
              icon="redo"
              label="Redo"
              disabled={!state.canRedo}
              onPress={() => run({ type: "redo" })}
            />
            <Divider />
            <Tool
              text={HEADING_SHORT[state.heading]}
              label="Text style"
              active={state.heading > 0}
              onPress={() => setMode("heading")}
            />
            <Divider />
            <Tool
              icon="format-bold"
              label="Bold"
              active={state.bold}
              onPress={() => run({ type: "bold" })}
            />
            <Tool
              icon="format-italic"
              label="Italic"
              active={state.italic}
              onPress={() => run({ type: "italic" })}
            />
            <Tool
              icon="format-underline"
              label="Underline"
              active={state.underline}
              onPress={() => run({ type: "underline" })}
            />
            <Tool
              icon="format-strikethrough-variant"
              label="Strikethrough"
              active={state.strike}
              onPress={() => run({ type: "strike" })}
            />
            <Tool
              icon="code-tags"
              label="Inline code"
              active={state.code}
              onPress={() => run({ type: "code" })}
            />
            <Tool
              icon="link-variant"
              label="Link"
              active={Boolean(state.link)}
              onPress={() => {
                setHref(state.link ?? "");
                setLinkOpen(true);
              }}
            />
            <Divider />
            <Tool
              icon="format-list-bulleted"
              label="Bulleted list"
              active={state.bulletList}
              onPress={() => run({ type: "bulletList" })}
            />
            <Tool
              icon="format-list-numbered"
              label="Numbered list"
              active={state.orderedList}
              onPress={() => run({ type: "orderedList" })}
            />
            <Tool
              icon="format-list-checks"
              label="Task list"
              active={state.taskList}
              onPress={() => run({ type: "taskList" })}
            />
            <Tool
              icon="format-quote-close"
              label="Quote"
              active={state.blockquote}
              onPress={() => run({ type: "blockquote" })}
            />
            <Tool
              icon="code-braces-box"
              label="Code block"
              active={state.codeBlock}
              onPress={() => run({ type: "codeBlock" })}
            />
            <Divider />
            <Tool
              icon={alignIcon}
              label="Alignment"
              active={state.align !== "left"}
              onPress={() => setMode("align")}
            />
          </>
        )}

        {mode === "heading" && (
          <>
            <Tool icon="chevron-left" label="Back" onPress={() => setMode("main")} />
            <Divider />
            {([0, 1, 2, 3, 4, 5, 6] as const).map((level) => (
              <Tool
                key={level}
                text={HEADING_SHORT[level]}
                label={level === 0 ? "Body text" : `Heading ${level}`}
                active={state.heading === level}
                onPress={() => {
                  run(level === 0 ? { type: "paragraph" } : { type: "heading", level });
                  setMode("main");
                }}
              />
            ))}
          </>
        )}

        {mode === "align" && (
          <>
            <Tool icon="chevron-left" label="Back" onPress={() => setMode("main")} />
            <Divider />
            {ALIGN.map((option) => (
              <Tool
                key={option.value}
                icon={option.icon}
                label={option.label}
                active={state.align === option.value}
                onPress={() => {
                  run({ type: "align", value: option.value });
                  setMode("main");
                }}
              />
            ))}
          </>
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={linkOpen}
        onRequestClose={() => setLinkOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setLinkOpen(false)} />
          <View style={[styles.linkCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.linkTitle, { color: colors.ink }]}>
              {state.link ? "Edit link" : "Add link"}
            </Text>
            <TextInput
              autoFocus
              value={href}
              onChangeText={setHref}
              placeholder="https://"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!href.trim()) return;
                setLinkOpen(false);
                run({ type: "link", href });
              }}
              style={[styles.linkInput, { color: colors.ink, borderColor: colors.border }]}
            />
            <View style={styles.linkActions}>
              {state.link && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setLinkOpen(false);
                    run({ type: "link", href: "" });
                  }}
                  style={styles.linkButton}
                >
                  <Text style={[styles.linkButtonText, { color: colors.destructive }]}>Remove</Text>
                </Pressable>
              )}
              <View style={styles.flex} />
              <Pressable
                accessibilityRole="button"
                onPress={() => setLinkOpen(false)}
                style={styles.linkButton}
              >
                <Text style={[styles.linkButtonText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!href.trim()}
                onPress={() => {
                  setLinkOpen(false);
                  run({ type: "link", href });
                }}
                style={[styles.linkButton, { opacity: href.trim() ? 1 : 0.4 }]}
              >
                <Text style={[styles.linkButtonText, { color: colors.hanko }]}>
                  {state.link ? "Update" : "Add"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Tool({
  icon,
  text,
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  icon?: IconName;
  text?: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const color = active ? colors.hanko : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        {
          backgroundColor: active ? colors.paper : "transparent",
          opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
        },
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      ) : (
        <Text style={[styles.toolText, { color }]}>{text}</Text>
      )}
    </Pressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { height: 48, borderTopWidth: StyleSheet.hairlineWidth },
  row: { alignItems: "center", paddingHorizontal: 6, gap: 2 },
  tool: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolText: { fontSize: 15, fontWeight: "700" },
  divider: { width: StyleSheet.hairlineWidth, height: 22, marginHorizontal: 4 },
  modalRoot: { flex: 1, justifyContent: "center", padding: 24 },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  linkCard: { borderRadius: 16, padding: 16, gap: 12 },
  linkTitle: { fontSize: 16, fontWeight: "600" },
  linkInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  linkActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkButton: { paddingHorizontal: 12, paddingVertical: 8 },
  linkButtonText: { fontSize: 15, fontWeight: "600" },
});
