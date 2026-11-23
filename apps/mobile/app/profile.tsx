import { useMemo, useState, type ReactNode } from "react";
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
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../src/theme";
import { haptics } from "../src/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  formatChapter,
  isSeriesKind,
  progressLabel,
} from "../src/library/series";
import { PressableScale } from "../src/components/pressable-scale";
import { SvgXml } from "react-native-svg";
import {
  AVATAR_STYLES,
  AVATAR_STYLE_KEYS,
  DEFAULT_AVATAR_STYLE,
  UserAvatar,
  avatarSvg,
  isAvatarStyle,
  type AvatarStyle,
} from "../src/components/user-avatar";

const number = (n: number) => new Intl.NumberFormat().format(n);

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
        styles.identityCard,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radii.card },
      ]}
    >
      <View style={styles.identity}>
        <UserAvatar user={user} size={56} />
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
      <AvatarPicker user={user} />
    </View>
  );
}

/** Pick a DiceBear style or shuffle the seed, like the web profile. Previews use the current seed. */
function AvatarPicker({ user }: { user: User }) {
  const { colors, radii } = useTheme();
  const update = useMutation(api.users.updateProfile);
  const style: AvatarStyle = isAvatarStyle(user.avatarStyle)
    ? user.avatarStyle
    : DEFAULT_AVATAR_STYLE;
  const seed = user.avatarSeed ?? user.id;
  const previews = useMemo(
    () => AVATAR_STYLE_KEYS.map((key) => ({ key, xml: avatarSvg(key, seed) })),
    [seed],
  );

  const save = (patch: { avatarStyle?: string; avatarSeed?: string }) =>
    update(patch).catch((error: unknown) => {
      console.error(error);
      Alert.alert("Couldn't save your avatar", "Try again.");
    });

  return (
    <View style={styles.picker}>
      <Text style={[styles.pickerLabel, { color: colors.muted }]}>Avatar</Text>
      <View
        style={styles.pickerRow}
        accessibilityRole="radiogroup"
        accessibilityLabel="Avatar style"
      >
        {previews.map(({ key, xml }) => {
          const selected = style === key;
          return (
            <PressableScale
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={AVATAR_STYLES[key].label}
              accessibilityState={{ checked: selected }}
              scale={0.92}
              onPress={() => {
                if (!selected) haptics.select();
                void save({ avatarStyle: key });
              }}
              style={[
                styles.swatch,
                {
                  borderColor: selected ? colors.hanko : "transparent",
                  opacity: selected ? 1 : 0.8,
                },
              ]}
            >
              <View style={[styles.swatchInner, { backgroundColor: colors.surfaceHighlight }]}>
                <SvgXml xml={xml} width={40} height={40} />
              </View>
            </PressableScale>
          );
        })}
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Shuffle avatar"
        onPress={() => {
          haptics.select();
          void save({ avatarSeed: newSeed() });
        }}
        style={[styles.shuffle, { borderColor: colors.border, borderRadius: radii.controls }]}
      >
        <Feather name="shuffle" size={14} color={colors.ink} />
        <Text style={[styles.shuffleText, { color: colors.ink }]}>Shuffle</Text>
      </PressableScale>
    </View>
  );
}

/** Hermes has no crypto.randomUUID; a random seed only needs to differ, not be secret. */
const newSeed = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

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
  identityCard: { padding: 20, gap: 18 },
  identity: { flexDirection: "row", alignItems: "center", gap: 16 },
  picker: { gap: 10 },
  pickerLabel: { fontSize: 13, fontWeight: "500" },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: { padding: 2, borderWidth: 2, borderRadius: 24 },
  swatchInner: { width: 40, height: 40, borderRadius: 20, overflow: "hidden" },
  shuffle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 34,
  },
  shuffleText: { fontSize: 13, fontWeight: "500" },
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
});
