import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../theme";
import { formatBytes } from "./releases";
import { installedBuild, updatesSupported, useUpdater } from "./updater";

export function UpdateBanner({ style }: { style?: ViewStyle }) {
  const { colors, radii, typography } = useTheme();
  const { check, install, installBuild } = useUpdater();

  if (!updatesSupported) return null;

  const available =
    check.phase === "done" && check.status.kind === "available" ? check.status.build : null;
  if (!available) return null;

  const downloading = install.phase === "downloading";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
        style,
      ]}
    >
      <Text style={[styles.title, typography.display, { color: colors.ink }]}>
        Update available
      </Text>
      <Text style={[typography.bodySm, { color: colors.muted }]}>
        li8 {available.version} ({formatBytes(available.apkSize)}). If the app is misbehaving,
        installing the latest build often fixes it.
      </Text>

      {downloading && (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceHighlight }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.hanko,
                width: `${Math.round((install.progress ?? 0) * 100)}%`,
              },
            ]}
          />
        </View>
      )}

      {install.phase === "error" && (
        <Text style={[typography.bodySm, { color: colors.destructive }]}>{install.message}</Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={downloading ? "Downloading…" : `Install ${available.version}`}
        accessibilityState={{ disabled: downloading }}
        disabled={downloading}
        onPress={() => void installBuild(available)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.hanko,
            borderRadius: radii.controls,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Text style={[styles.buttonText, typography.display, { color: "#FFFFFF" }]}>
          {downloading ? "Downloading…" : `Install ${available.version}`}
        </Text>
      </Pressable>
    </View>
  );
}

export function VersionFootnote() {
  const { colors, typography } = useTheme();
  // Dev builds and Expo Go report their own host's version, not li8's.
  if (!updatesSupported || !installedBuild.version) return null;

  return (
    <Text style={[typography.bodySm, styles.footnote, { color: colors.muted }]}>
      li8 {installedBuild.version}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  title: {
    fontSize: 16,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
  },
  button: {
    width: "100%",
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 15,
  },
  footnote: {
    marginTop: 24,
    fontSize: 12,
    textAlign: "center",
  },
});
