import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Wordmark } from "../src/components/brand";
import { useTheme } from "../src/theme";
import { useMobileGoogleSignIn } from "../src/auth";
import { UpdateBanner, VersionFootnote } from "../src/updates/update-banner";

export default function SignInScreen() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { colors, radii, typography } = useTheme();
  const { startGoogleSignIn, isSubmitting, errorMessage } = useMobileGoogleSignIn();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)/notes" />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.paper }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Wordmark size={36} />
        </View>

        <View style={styles.heroSection}>
          <Text style={[styles.headline, typography.display, { color: colors.ink }]}>
            Remember where you left off.
          </Text>
          <Text style={[styles.subtitle, typography.body, { color: colors.muted }]}>
            li8 is a private notebook and a tracker for reading and watching progress. Keep your
            place in the manga, novels, and shows you follow.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
            onPress={startGoogleSignIn}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.googleButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.controls,
                opacity: isSubmitting ? 0.7 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <View style={styles.buttonContent}>
                <Image
                  source={require("../assets/google-g.png")}
                  style={styles.googleLogo}
                  resizeMode="contain"
                  accessible={false}
                />
                <Text style={[styles.buttonText, typography.display, { color: colors.ink }]}>
                  Continue with Google
                </Text>
              </View>
            )}
          </Pressable>

          {errorMessage && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMessage}</Text>
          )}

          <UpdateBanner style={styles.updateBanner} />

          <View style={styles.pointsList}>
            <Point
              title="Notes that save as you type"
              description="No save button, no folders to file into."
            />
            <Point
              title="One search for everything"
              description="Finds notes and series by title or meaning."
            />
            <Point
              title="Works offline"
              description="Installs like an app and syncs when you reconnect."
            />
          </View>
        </View>
        <VersionFootnote />
      </ScrollView>
    </SafeAreaView>
  );
}

function Point({ title, description }: { title: string; description: string }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.pointItem}>
      <Text style={[styles.pointTitle, typography.display, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.pointDescription, typography.bodySm, { color: colors.muted }]}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  heroSection: {
    flex: 1,
    justifyContent: "center",
  },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
  },
  googleButton: {
    marginTop: 32,
    height: 52,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  buttonText: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
  },
  updateBanner: {
    marginTop: 24,
  },
  pointsList: {
    marginTop: 48,
    gap: 24,
  },
  pointItem: {
    gap: 4,
  },
  pointTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  pointDescription: {
    fontSize: 14,
  },
});
