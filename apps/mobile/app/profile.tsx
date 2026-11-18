import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../src/theme";
import { haptics } from "../src/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemePreference, type ThemePreference } from "../src/theme-preference";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  formatChapter,
  isSeriesKind,
  progressLabel,
} from "../src/library/series";
import { UpdateSettings } from "../src/updates/update-settings";
import { PressableScale } from "../src/components/pressable-scale";

const number = (n: number) => new Intl.NumberFormat().format(n);

const THEMES: { value: ThemePreference; label: string; icon: "sun" | "moon" | "smartphone" }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "Match device", icon: "smartphone" },
];

export default function ProfileScreen() {
  const user = useQuery(api.users.me);
  const [tzOffsetMinutes] = useState(() => new Date().getTimezoneOffset());
  const stats = useQuery(api.users.stats, { tzOffsetMinutes });
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (user === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <ActivityIndicator size="small" color={colors.hanko} />
      </View>
    );
  }
  if (user === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <Text style={{ color: colors.muted }}>Not signed in.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Identity user={user} />

      {stats === undefined ? (
        <ActivityIndicator size="small" color={colors.hanko} style={styles.statsLoading} />
      ) : stats ? (
        <>
          <Totals stats={stats} />
          <Section title="Reading log">
            <ActivityGrid activity={stats.activity} />
          </Section>
          {stats.series > 0 && (
            <Section title="Library">
              <StatusList byStatus={stats.byStatus} />
            </Section>
          )}
          {stats.current.length > 0 && (
            <Section title="In progress">
              <InProgress current={stats.current} />
            </Section>
          )}
        </>
      ) : null}

      <Section title="Appearance">
        <ThemePicker />
      </Section>

      <UpdateSettings />

      <SignOut />
    </ScrollView>
  );
}

type User = NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>;
type Stats = NonNullable<ReturnType<typeof useQuery<typeof api.users.stats>>>;

function Identity({ user }: { user: User }) {
  const { colors, radii, typography } = useTheme();
  const update = useMutation(api.users.updateProfile);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);

  const joined = new Date(user.joinedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === user.name) {
      setName(user.name ?? "");
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await update({ name: trimmed });
      haptics.success();
      setEditing(false);
    } catch {
      Alert.alert("Couldn't save your name", "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        styles.identity,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surfaceHighlight }]}>
        <Text style={[styles.avatarInitial, typography.display, { color: colors.hanko }]}>
          {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        {editing ? (
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => void save()}
            onBlur={() => void save()}
            autoFocus
            maxLength={80}
            returnKeyType="done"
            accessibilityLabel="Your name"
            editable={!saving}
            style={[
              styles.nameInput,
              typography.display,
              { color: colors.ink, borderColor: colors.border, borderRadius: radii.controls },
            ]}
          />
        ) : (
          <Pressable
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
            style={styles.nameRow}
          >
            <Text
              numberOfLines={1}
              style={[styles.name, typography.display, { color: colors.ink }]}
            >
              {user.name || "Reader"}
            </Text>
            <Feather name="edit-2" size={14} color={colors.muted} />
          </Pressable>
        )}
        {user.email && (
          <Text numberOfLines={1} style={[typography.bodySm, { color: colors.muted }]}>
            {user.email}
          </Text>
        )}
        <Text style={[styles.joined, { color: colors.muted }]}>Member since {joined}</Text>
      </View>
    </View>
  );
}

function Totals({ stats }: { stats: Stats }) {
  const { colors, radii, typography } = useTheme();
  const plus = stats.capped ? "+" : "";
  const items = [
    { value: `${number(stats.notes)}${plus}`, label: stats.notes === 1 ? "note" : "notes" },
    { value: `${number(stats.series)}${plus}`, label: "in your library" },
    { value: number(stats.chapters), label: "chapters read" },
    { value: number(stats.episodes), label: "episodes watched" },
  ];
  return (
    <View style={styles.totals}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            styles.total,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
          ]}
        >
          <Text style={[styles.totalValue, typography.number, { color: colors.ink }]}>
            {item.value}
          </Text>
          <Text style={[typography.bodySm, { color: colors.muted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** 12 weeks of progress updates, one square per day, oldest first, like the web's reading log. */
function ActivityGrid({ activity }: { activity: number[] }) {
  const { colors, radii } = useTheme();
  const max = Math.max(1, ...activity);
  const total = activity.reduce((sum, n) => sum + n, 0);
  const weeks: number[][] = [];
  for (let i = 0; i < activity.length; i += 7) weeks.push(activity.slice(i, i + 7));

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
      ]}
      accessible
      accessibilityLabel={`Activity over the last 12 weeks: ${total} updates`}
    >
      <View style={styles.grid}>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((count, d) => (
              <View
                key={d}
                style={[
                  styles.day,
                  count === 0
                    ? { backgroundColor: colors.surfaceHighlight }
                    : { backgroundColor: colors.hanko, opacity: 0.3 + 0.7 * (count / max) },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <Text style={[styles.gridCaption, { color: colors.muted }]}>
        {total === 0
          ? "No progress logged in the last 12 weeks."
          : `${number(total)} ${total === 1 ? "update" : "updates"} in the last 12 weeks`}
      </Text>
    </View>
  );
}

function StatusList({ byStatus }: { byStatus: Record<string, number> }) {
  const { colors, radii } = useTheme();
  const router = useRouter();
  const rows = STATUS_ORDER.map((s) => ({ status: s, count: byStatus[s] ?? 0 })).filter(
    (r) => r.count > 0,
  );
  return (
    <View
      style={[
        styles.list,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
      ]}
    >
      {rows.map((r, i) => (
        <Pressable
          key={r.status}
          onPress={() => router.push("/library")}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            pressed && { backgroundColor: colors.surfaceHighlight },
          ]}
        >
          <Text style={[styles.flex, { color: colors.ink }]}>{STATUS_LABEL[r.status]}</Text>
          <Text style={[styles.mono, { color: colors.muted }]}>{number(r.count)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function InProgress({ current }: { current: Stats["current"] }) {
  const { colors, radii } = useTheme();
  const router = useRouter();
  return (
    <View
      style={[
        styles.list,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
      ]}
    >
      {current.map((s, i) => (
        <Pressable
          key={s.id}
          onPress={() =>
            router.push({ pathname: "/(tabs)/library/[seriesId]", params: { seriesId: s.id } })
          }
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            pressed && { backgroundColor: colors.surfaceHighlight },
          ]}
        >
          <Text numberOfLines={1} style={[styles.flex, styles.rowTitle, { color: colors.ink }]}>
            {s.title}
          </Text>
          <Text style={[styles.mono, { color: colors.muted }]}>
            {isSeriesKind(s.kind) && progressLabel(s.kind) === "Episode" ? "Ep" : "Ch"}{" "}
            {formatChapter(s.chapter)}
            {s.totalChapters ? ` / ${formatChapter(s.totalChapters)}` : ""}
          </Text>
        </Pressable>
      ))}
    </View>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20, gap: 24 },
  flex: { flex: 1 },
  card: { padding: 16, borderWidth: 1 },
  identity: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { fontSize: 24 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 20, letterSpacing: -0.3, flexShrink: 1 },
  nameInput: { fontSize: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  joined: { fontSize: 13, marginTop: 4 },
  statsLoading: { marginVertical: 24 },
  totals: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  total: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, padding: 14 },
  totalValue: { fontSize: 22 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, letterSpacing: -0.2 },
  grid: { flexDirection: "row", gap: 3, justifyContent: "space-between" },
  week: { gap: 3, flex: 1 },
  day: { aspectRatio: 1, borderRadius: 3 },
  gridCaption: { fontSize: 12, marginTop: 10 },
  list: { borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, height: 48 },
  rowTitle: { fontWeight: "500" },
  mono: { fontVariant: ["tabular-nums"], fontSize: 13 },
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
