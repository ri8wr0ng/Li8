import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { formatBytes, type UpdateChannel } from "./releases";
import { installedBuild, updatesSupported, useUpdater } from "./updater";

const CHANNELS: { value: UpdateChannel; label: string; hint: string }[] = [
  { value: "stable", label: "Stable", hint: "Tested releases." },
  {
    value: "nightly",
    label: "Nightly",
    hint: "The newest build, a few times a day. May be rough.",
  },
];

export function UpdateSettings() {
  const { colors, radii, typography } = useTheme();
  const { channel, setChannel, check, install, checkForUpdates, installBuild } = useUpdater();

  const versionLabel = installedBuild.version
    ? `Version ${installedBuild.version}${installedBuild.versionCode ? ` (build ${installedBuild.versionCode})` : ""}`
    : "Development build";

  if (!updatesSupported) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
        ]}
      >
        <Text style={[styles.title, typography.display, { color: colors.ink }]}>App updates</Text>
        <Text style={[typography.bodySm, { color: colors.muted }]}>{versionLabel}</Text>
        <Text style={[typography.bodySm, { color: colors.muted }]}>
          In-app updates work in the Android release app.
        </Text>
      </View>
    );
  }

  const status = check.phase === "done" ? check.status : null;
  const downloading = install.phase === "downloading";

  let message: string;
  if (check.phase === "checking") message = "Checking for updates…";
  else if (check.phase === "error") message = check.message;
  else if (!status) message = "";
  else if (status.kind === "none") message = `No ${channel} release yet.`;
  else if (status.kind === "current") message = "You're on the latest build.";
  else if (status.kind === "ahead")
    message = `You're on a newer build than the latest ${channel} (${status.build.version}). You'll get the next ${channel} release when it's newer.`;
  else message = `li8 ${status.build.version} is available (${formatBytes(status.build.apkSize)}).`;

  const available = status?.kind === "available" ? status.build : null;
  const progress = install.phase === "downloading" ? install.progress : null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, typography.display, { color: colors.ink }]}>App updates</Text>
        <Text style={[typography.bodySm, { color: colors.muted }]}>{versionLabel}</Text>
      </View>

      <View
        accessibilityRole="radiogroup"
        style={[
          styles.segmented,
          { backgroundColor: colors.surfaceHighlight, borderRadius: radii.controls },
        ]}
      >
        {CHANNELS.map((option) => {
          const selected = option.value === channel;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: downloading }}
              disabled={downloading}
              onPress={() => setChannel(option.value)}
              style={[
                styles.segment,
                { borderRadius: radii.controls - 3 },
                selected && { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  typography.display,
                  { color: selected ? colors.ink : colors.muted },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[typography.bodySm, { color: colors.muted }]}>
        {CHANNELS.find((option) => option.value === channel)?.hint}
      </Text>

      {message !== "" && (
        <Text
          style={[
            typography.bodySm,
            { color: check.phase === "error" ? colors.destructive : colors.ink },
          ]}
        >
          {message}
        </Text>
      )}
      {install.phase === "error" && (
        <Text style={[typography.bodySm, { color: colors.destructive }]}>{install.message}</Text>
      )}

      {downloading && (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceHighlight }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.hanko, width: `${Math.round((progress ?? 0) * 100)}%` },
            ]}
          />
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          disabled={downloading || check.phase === "checking"}
          onPress={() => (available ? void installBuild(available) : void checkForUpdates())}
          style={({ pressed }) => [
            styles.button,
            {
              borderRadius: radii.controls,
              backgroundColor: available ? colors.hanko : colors.card,
              borderColor: available ? colors.hanko : colors.border,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {downloading || check.phase === "checking" ? (
            <ActivityIndicator size="small" color={available ? "#FFFFFF" : colors.ink} />
          ) : (
            <Text
              style={[
                styles.buttonText,
                typography.display,
                { color: available ? "#FFFFFF" : colors.ink },
              ]}
            >
              {available
                ? downloading
                  ? "Downloading…"
                  : `Install ${available.version}`
                : "Check for updates"}
            </Text>
          )}
        </Pressable>
        {status && status.kind !== "none" && (
          <Pressable onPress={() => void Linking.openURL(status.build.pageUrl)} hitSlop={8}>
            <Text
              style={[typography.bodySm, { color: colors.muted, textDecorationLine: "underline" }]}
            >
              Release notes
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
  segmented: {
    flexDirection: "row",
    padding: 3,
  },
  segment: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  button: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 15,
  },
});
