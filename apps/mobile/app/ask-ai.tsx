import { useState } from "react";
import { StyleSheet } from "react-native";
import { KeyboardAvoider } from "../src/components/keyboard-avoider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Conversation } from "../src/ask/conversation";
import { useTheme } from "../src/theme";

/** The ✦ button: a fresh chat with the assistant in a sheet, from anywhere in the app. */
export default function AskAiSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [threadId, setThreadId] = useState<string | undefined>();

  return (
    <KeyboardAvoider style={[styles.flex, { backgroundColor: colors.paper }]}>
      <Conversation threadId={threadId} onThread={setThreadId} bottomInset={insets.bottom + 8} />
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
