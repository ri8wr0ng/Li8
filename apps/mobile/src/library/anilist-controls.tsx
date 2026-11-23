import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc } from "@inkmark/backend/convex/_generated/dataModel";
import type { SeriesKind } from "@inkmark/backend/convex/validators";
import { useTheme } from "../theme";
import { haptics } from "../haptics";
import {
  type AniListMedia,
  AniListError,
  catalogFor,
  catalogName,
  errorMessage,
  getCatalog,
  linkedSource,
  patchFrom,
  resolveMatch,
  samePatch,
  snapshotOf,
} from "./anilist";
import { AniListResults, useAniListSearch } from "./anilist-results";

/**
 * Pull details from AniList into a series. Your own names and genres are kept
 * and AniList's are added; description, type and chapter count follow AniList.
 * Your title is left alone. Every apply can be undone from the alert.
 */
export function AniListControls({ series }: { series: Doc<"series"> }) {
  const { colors, radii } = useTheme();
  const update = useMutation(api.series.update);
  const linked = linkedSource(series);
  const source = linked?.source ?? catalogFor(series.kind);
  const name = catalogName(source);
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);

  async function apply(media: AniListMedia, verb: string) {
    const before = snapshotOf(series);
    const after = patchFrom(series, await resolveMatch(media));
    if (samePatch(before, after)) {
      Alert.alert(`Already up to date with ${catalogName(media.source)}`);
      return;
    }
    await update({ id: series._id, ...after });
    haptics.success();
    Alert.alert(verb, undefined, [
      {
        text: "Undo",
        style: "cancel",
        onPress: () => void update({ id: series._id, ...before }),
      },
      { text: "OK" },
    ]);
  }

  async function refresh() {
    if (!linked) return;
    setBusy(true);
    try {
      await apply(await getCatalog(linked.source, linked.id), `Updated from ${name}`);
    } catch (err) {
      if (!(err instanceof AniListError)) console.error(err);
      Alert.alert(
        name,
        errorMessage(err, source),
        err instanceof AniListError && err.kind === "not_found"
          ? [{ text: "Find again", onPress: () => setFinding(true) }, { text: "OK" }]
          : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    const before = { anilistId: series.anilistId ?? null, tvmazeId: series.tvmazeId ?? null };
    await update({ id: series._id, anilistId: null, tvmazeId: null });
    Alert.alert(`Unlinked from ${name}`, undefined, [
      {
        text: "Undo",
        style: "cancel",
        onPress: () => void update({ id: series._id, ...before }),
      },
      { text: "OK" },
    ]);
  }

  return (
    <View style={styles.row}>
      {linked ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Refresh from ${name}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void refresh()}
            style={({ pressed }) => [
              styles.button,
              { borderColor: colors.border, backgroundColor: colors.card },
              { borderRadius: radii.controls },
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Feather name="refresh-cw" size={15} color={colors.ink} />
            )}
            <Text style={[styles.buttonText, { color: colors.ink }]}>Refresh from {name}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change match"
            onPress={() => setFinding(true)}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Text style={[styles.buttonText, { color: colors.muted }]}>Change match</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Unlink from ${name}`}
            onPress={() => void unlink()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="x-circle" size={16} color={colors.muted} />
          </Pressable>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setFinding(true)}
          style={({ pressed }) => [
            styles.button,
            { borderColor: colors.border, backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="star" size={15} color={colors.hanko} />
          <Text style={[styles.buttonText, { color: colors.ink }]}>Fill in from {name}</Text>
        </Pressable>
      )}

      <Modal
        visible={finding}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFinding(false)}
      >
        {finding ? (
          <Finder
            initial={series.title}
            kind={series.kind}
            selectedId={linked?.id}
            onClose={() => setFinding(false)}
            onPick={(media) => {
              setFinding(false);
              apply(media, `Filled in from ${catalogName(media.source)}`).catch((err: unknown) => {
                if (!(err instanceof AniListError)) console.error(err);
                Alert.alert(
                  catalogName(media.source),
                  err instanceof AniListError
                    ? errorMessage(err, media.source)
                    : "Couldn't save. Please try again.",
                );
              });
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

/** Its own component so the query resets every time the finder opens. */
function Finder({
  initial,
  kind,
  selectedId,
  onClose,
  onPick,
}: {
  initial: string;
  kind: SeriesKind;
  selectedId?: number;
  onClose: () => void;
  onPick: (media: AniListMedia) => void;
}) {
  const { colors, radii, typography } = useTheme();
  const [query, setQuery] = useState(initial);
  const state = useAniListSearch(query, kind);
  const name = catalogName(catalogFor(kind));

  return (
    <View style={[styles.finder, { backgroundColor: colors.paper }]}>
      <View style={styles.finderHeader}>
        <Text style={[styles.finderTitle, typography.display, { color: colors.ink }]}>
          Find on {name}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Feather name="x" size={22} color={colors.muted} />
        </Pressable>
      </View>

      <Text style={[styles.finderHint, { color: colors.muted }]}>
        Adds names and genres, and fills in the description, type and{" "}
        {kind === "tv" || kind === "reality" || kind === "anime" || kind === "movie"
          ? "episode"
          : "chapter"}{" "}
        count. Your title stays as it is.
      </Text>

      <TextInput
        autoFocus
        value={query}
        onChangeText={setQuery}
        placeholder={`Search ${name}`}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        style={[
          styles.input,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            borderRadius: radii.controls,
            color: colors.ink,
          },
        ]}
      />

      <ScrollView keyboardShouldPersistTaps="handled">
        <AniListResults kind={kind} state={state} selectedId={selectedId} onPick={onPick} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  button: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ghostButton: {
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    height: 40,
    width: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 14, fontWeight: "600" },
  pressed: { opacity: 0.7 },
  finder: { flex: 1, padding: 16, gap: 12 },
  finderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  finderTitle: { fontSize: 20 },
  closeButton: { height: 32, width: 32, alignItems: "center", justifyContent: "center" },
  finderHint: { fontSize: 13, lineHeight: 18 },
  input: {
    height: 46,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});
