import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Conversation } from "../src/ask/conversation";
import { useTheme } from "../src/theme";

/** The ✦ button: a fresh chat with the assistant in a sheet, from anywhere in the app. */
export default function AskAiSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [threadId, setThreadId] = useState<string | undefined>();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.paper }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Conversation threadId={threadId} onThread={setThreadId} bottomInset={insets.bottom + 8} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
