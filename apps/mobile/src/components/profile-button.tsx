import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../theme";
import { PressableScale } from "./pressable-scale";

/** The signed-in reader's initial, top-left in every tab's header. Opens Profile. */
export function ProfileButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const me = useQuery(api.users.me);
  const initial = (me?.name?.[0] || me?.email?.[0] || "").toUpperCase();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Profile and settings"
      hitSlop={8}
      scale={0.9}
      onPress={() => router.push("/profile")}
      containerStyle={styles.target}
      style={[
        styles.avatar,
        { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
      ]}
    >
      <View>
        <Text style={[styles.initial, { color: colors.hanko }]}>{initial || "·"}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  target: { marginLeft: 4, marginRight: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 15, fontWeight: "700" },
});
