import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../theme";
import { PressableScale } from "./pressable-scale";
import { UserAvatar } from "./user-avatar";

const SIZE = 36;

/** A round header button. Every tab's header uses it so the right side reads as one set. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  busy = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      disabled={busy}
      hitSlop={4}
      scale={0.9}
      onPress={onPress}
      style={[styles.round, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.hanko} />
      ) : (
        <Feather name={icon} size={18} color={colors.hanko} />
      )}
    </PressableScale>
  );
}

/**
 * Right side of every tab's header: the screen's own action (if any), then the
 * gear for Settings, then the reader's avatar for Profile.
 */
export function HeaderActions({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const { colors } = useTheme();
  const me = useQuery(api.users.me);

  return (
    <View style={styles.row}>
      {children}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={4}
        scale={0.9}
        onPress={() => router.push("/settings")}
        style={[styles.round, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Feather name="settings" size={18} color={colors.ink} />
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Profile"
        hitSlop={4}
        scale={0.9}
        onPress={() => router.push("/profile")}
      >
        <UserAvatar user={me} size={SIZE} style={[styles.avatar, { borderColor: colors.border }]} />
      </PressableScale>
    </View>
  );
}

/** Big left-aligned title for the root screen of each tab. */
export const tabRootHeader = {
  headerTitleAlign: "left" as const,
  headerTitleStyle: { fontSize: 24, fontWeight: "700" as const },
  headerRight: () => <HeaderActions />,
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 4 },
  round: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { borderWidth: StyleSheet.hairlineWidth },
});
