import { useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { clearCache, useCachedQuery, useSessionGate } from "../src/offline";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../src/theme";
import { haptics } from "../src/haptics";
import { useThemePreference, type ThemePreference } from "../src/theme-preference";
import { UpdateSettings } from "../src/updates/update-settings";
import { PressableScale } from "../src/components/pressable-scale";
import { UserAvatar } from "../src/components/user-avatar";

const THEMES: { value: ThemePreference; label: string; icon: "sun" | "moon" | "smartphone" }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "Match device", icon: "smartphone" },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const gate = useSessionGate();

  // Sign out happens here; the tabs' own redirect only runs once they're focused again.
  if (gate === "signed-out") return <Redirect href="/sign-in" />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <Section title="Account">
        <AccountRow />
      </Section>
      <Section title="Appearance">
        <ThemePicker />
      </Section>
      <UpdateSettings />
      <SignOut />
    </ScrollView>
  );
}

function AccountRow() {
  const router = useRouter();
  const { colors, radii, typography } = useTheme();
  const me = useCachedQuery(api.users.me, {});

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Edit profile"
      onPress={() => router.push("/profile")}
      style={[
        styles.account,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
      ]}
    >
      <UserAvatar user={me} size={44} />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.accountName, { color: colors.ink }]}>
          {me?.name || "Signed in"}
        </Text>
        {me?.email ? (
          <Text numberOfLines={1} style={[typography.bodySm, { color: colors.muted }]}>
            {me.email}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.accountLink, { color: colors.muted }]}>Edit profile</Text>
      <Feather name="chevron-right" size={16} color={colors.muted} />
    </PressableScale>
  );
}

function ThemePicker() {
  const { colors, radii } = useTheme();
  const [theme, setTheme] = useThemePreference();
  return (
    <View style={styles.themes} accessibilityRole="radiogroup" accessibilityLabel="Theme">
      {THEMES.map((t) => {
        const selected = theme === t.value;
        return (
          <PressableScale
            key={t.value}
            containerStyle={styles.flex}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (t.value !== theme) haptics.select();
              setTheme(t.value);
            }}
            style={[
              styles.theme,
              {
                backgroundColor: colors.card,
                borderColor: selected ? colors.ink : colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Feather name={t.icon} size={20} color={selected ? colors.ink : colors.muted} />
            <Text style={[styles.themeLabel, { color: selected ? colors.ink : colors.muted }]}>
              {t.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function SignOut() {
  const { signOut } = useAuthActions();
  const { colors, radii, typography } = useTheme();
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      await signOut();
      // So the next account never sees this one's notes.
      await clearCache();
    } catch (error) {
      console.error("Sign out error:", error);
      setBusy(false);
    }
  }

  return (
    <PressableScale
      onPress={() => void handle()}
      disabled={busy}
      style={[
        styles.signOut,
        {
          borderColor: colors.border,
          borderRadius: radii.controls,
          backgroundColor: colors.card,
          opacity: busy ? 0.7 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.destructive} />
      ) : (
        <>
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.signOutText, typography.display, { color: colors.destructive }]}>
            Sign out
          </Text>
        </>
      )}
    </PressableScale>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, typography.display, { color: colors.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 24 },
  flex: { flex: 1 },
  account: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1 },
  accountName: { fontSize: 16, fontWeight: "600" },
  accountLink: { fontSize: 13 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, letterSpacing: -0.2 },
  themes: { flexDirection: "row", gap: 8 },
  theme: { alignItems: "center", gap: 8, paddingVertical: 16, borderWidth: 1 },
  themeLabel: { fontSize: 13, fontWeight: "500" },
  signOut: {
    height: 48,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  signOutText: { fontSize: 15 },
});
