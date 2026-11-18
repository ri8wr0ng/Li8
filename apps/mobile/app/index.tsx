import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { BookmarkIcon } from "../src/components/brand";
import { useTheme } from "../src/theme";

export default function IndexScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.paper }]}>
        <BookmarkIcon size={64} />
        <ActivityIndicator size="small" color={colors.hanko} style={styles.spinner} />
      </View>
    );
  }

  if (isAuthenticated) {
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
});
