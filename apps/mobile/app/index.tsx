import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { BookmarkIcon } from "../src/components/brand";
import { useSessionGate } from "../src/offline";
import { useTheme } from "../src/theme";

export default function IndexScreen() {
  const gate = useSessionGate();
  const { colors, typography } = useTheme();

  if (gate === "offline-first-run") {
    return (
      <View style={[styles.container, styles.padded, { backgroundColor: colors.paper }]}>
        <BookmarkIcon size={48} />
        <Text style={[styles.title, typography.display, { color: colors.ink }]}>
          You're offline
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          li8 saves a copy of your notes and library once it has synced. Connect once and it'll open
          without a network after that.
        </Text>
      </View>
    );
  }

  if (gate === "loading") {
    return (
      <View style={[styles.container, { backgroundColor: colors.paper }]}>
        <BookmarkIcon size={64} />
        <ActivityIndicator size="small" color={colors.hanko} style={styles.spinner} />
      </View>
    );
  }

  if (gate === "app") {
    return <Redirect href="/(tabs)/notes" />;
  }

  return <Redirect href="/sign-in" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    marginTop: 24,
  },
  padded: { paddingHorizontal: 32 },
  title: { marginTop: 20, fontSize: 22, letterSpacing: -0.3 },
  body: { marginTop: 8, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 300 },
});
