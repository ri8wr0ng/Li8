import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../theme";
import { PressableScale } from "./pressable-scale";
import { UserAvatar } from "./user-avatar";

/** Top-left in every tab's header: the reader's avatar opens Profile, the gear opens Settings. */
export function ProfileButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const me = useQuery(api.users.me);

  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Profile"
        hitSlop={8}
        scale={0.9}
        onPress={() => router.push("/profile")}
      >
        <UserAvatar user={me} size={32} style={[styles.avatar, { borderColor: colors.border }]} />
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={8}
        scale={0.9}
        onPress={() => router.push("/settings")}
        style={styles.gear}
      >
        <Feather name="settings" size={20} color={colors.muted} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 4, marginRight: 8 },
  avatar: { borderWidth: StyleSheet.hairlineWidth },
  gear: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
