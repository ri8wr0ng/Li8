import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../src/theme";

export default function LibraryScreen() {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      <Text style={[styles.heading, typography.display, { color: colors.ink }]}>Library</Text>
      <Text style={[styles.subtitle, typography.bodySm, { color: colors.muted }]}>
        Track your reading progress across manga, novels, and shows.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  heading: {
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
  },
});
