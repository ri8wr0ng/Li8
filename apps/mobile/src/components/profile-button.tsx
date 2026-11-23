import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../theme";
import { PressableScale } from "./pressable-scale";
import { UserAvatar } from "./user-avatar";

/** The signed-in reader's avatar, top-left in every tab's header. Opens Profile. */
export function ProfileButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const me = useQuery(api.users.me);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Profile and settings"
      hitSlop={8}
      scale={0.9}
      onPress={() => router.push("/profile")}
      containerStyle={styles.target}
    >
      <UserAvatar user={me} size={32} style={[styles.avatar, { borderColor: colors.border }]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  target: { marginLeft: 4, marginRight: 8 },
  avatar: { borderWidth: StyleSheet.hairlineWidth },
});
