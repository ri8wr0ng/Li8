import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useTabBarInset } from "../../../src/components/glass";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { SeriesKind, SeriesStatus } from "@inkmark/backend/convex/validators";
import { useTheme } from "../../../src/theme";
import { isEpisodic, KIND_OPTIONS, STATUS_ORDER, statusLabel } from "../../../src/library/series";

export default function NewSeriesScreen() {
  const router = useRouter();
  const tabBarInset = useTabBarInset();
  const { colors, radii, typography } = useTheme();

  const createSeries = useMutation(api.series.create);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<SeriesKind>("manga");
  const [status, setStatus] = useState<SeriesStatus>("reading");
  const [chapter, setChapter] = useState("0");
  const [season, setSeason] = useState("1");
  const [totalChapters, setTotalChapters] = useState("");
  const [altNames, setAltNames] = useState("");
  const [genres, setGenres] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleError, setTitleError] = useState("");

  const episodic = isEpisodic(kind);

  const handleKindSelect = (selectedKind: SeriesKind) => {
    setKind(selectedKind);
  };

  const handleStatusSelect = (selectedStatus: SeriesStatus) => {
    setStatus(selectedStatus);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError("Title is required");
      return;
    }
    setTitleError("");

    const chapNum = Number(chapter.trim());
    if (!Number.isFinite(chapNum) || chapNum < 0) {
      Alert.alert("Invalid number", "Chapter must be 0 or more");
      return;
    }

    const seasonNum = episodic ? Number(season.trim()) || 1 : undefined;

    const totChaptersNum = Number(totalChapters.trim());
    const totalChaptersVal =
      totalChapters.trim() && Number.isFinite(totChaptersNum) && totChaptersNum > 0
        ? totChaptersNum
        : undefined;

    const altNamesArr = altNames
      .split(/[,·]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const genresArr = genres
      .split(/[,·]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      const newId = await createSeries({
        title: trimmedTitle,
        kind,
        status,
        chapter: chapNum,
        season: seasonNum,
        totalChapters: totalChaptersVal,
        altNames: altNamesArr.length > 0 ? altNamesArr : undefined,
        genres: genresArr.length > 0 ? genresArr : undefined,
        description: description.trim() || undefined,
      });

      if (newId) {
        router.replace({
          pathname: "/library/[seriesId]",
          params: { seriesId: newId },
        });
      } else {
        router.back();
      }
    } catch (err) {
      console.error("Create series error:", err);
      Alert.alert("Error", "Could not create series. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Add to Library",
          headerBackTitle: "Library",
        }}
      />

      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.paper }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title Input */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.ink }]}>Title *</Text>
            <TextInput
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (titleError) setTitleError("");
              }}
              placeholder="e.g. Solo Leveling, Frieren, Arcane…"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  color: colors.ink,
                  borderColor: titleError ? colors.destructive : colors.border,
                  backgroundColor: colors.card,
                  borderRadius: radii.controls,
                },
              ]}
              autoFocus
            />
            {titleError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{titleError}</Text>
            ) : null}
          </View>

          {/* Type / Kind Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.ink }]}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
            >
              {KIND_OPTIONS.map((item) => {
                const isSelected = kind === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleKindSelect(item.value)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? colors.hanko : colors.card,
                        borderColor: isSelected ? colors.hanko : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        {
                          color: isSelected ? "#FFFFFF" : colors.ink,
                          fontWeight: isSelected ? "600" : "500",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Status Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.ink }]}>Status</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
            >
              {STATUS_ORDER.map((s) => {
                const isSelected = status === s;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityLabel={statusLabel(s, kind)}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleStatusSelect(s)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? colors.hanko : colors.card,
                        borderColor: isSelected ? colors.hanko : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        {
                          color: isSelected ? "#FFFFFF" : colors.ink,
                          fontWeight: isSelected ? "600" : "500",
                        },
                      ]}
                    >
                      {statusLabel(s, kind)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Chapter / Progress Inputs */}
          {kind !== "movie" ? (
            <View style={styles.rowTwoCols}>
              {episodic && (
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.ink }]}>Season</Text>
                  <TextInput
                    value={season}
                    onChangeText={setSeason}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.input,
                      typography.number,
                      {
                        color: colors.ink,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        borderRadius: radii.controls,
                      },
                    ]}
                  />
                </View>
              )}

              <View style={[styles.formGroup, { flex: 1.5 }]}>
                <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                  {episodic ? "Episode" : "Current Chapter"}
                </Text>
                <TextInput
                  value={chapter}
                  onChangeText={setChapter}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.input,
                    typography.number,
                    {
                      color: colors.ink,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      borderRadius: radii.controls,
                    },
                  ]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1.5 }]}>
                <Text style={[styles.fieldLabel, { color: colors.ink }]}>Total Count</Text>
                <TextInput
                  value={totalChapters}
                  onChangeText={setTotalChapters}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.input,
                    typography.number,
                    {
                      color: colors.ink,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      borderRadius: radii.controls,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Alternative Names */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.ink }]}>
              Alternative Names (comma-separated)
            </Text>
            <TextInput
              value={altNames}
              onChangeText={setAltNames}
              placeholder="e.g. SL, Na Honjaman Lebel-eob"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: radii.controls,
                },
              ]}
            />
          </View>

          {/* Genres */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.ink }]}>Genres (comma-separated)</Text>
            <TextInput
              value={genres}
              onChangeText={setGenres}
              placeholder="Action, Fantasy, Adventure…"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: radii.controls,
                },
              ]}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.ink }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder="What's it about? Where did you hear about it?"
              placeholderTextColor={colors.muted}
              style={[
                styles.textArea,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: radii.controls,
                },
              ]}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add to library"
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.hanko,
                borderRadius: radii.controls,
                opacity: isSubmitting ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Adding…" : "Add to library"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    height: 46,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
  chipsScroll: {
    flexDirection: "row",
    marginTop: 2,
  },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
  },
  choiceChipText: {
    fontSize: 13,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    gap: 8,
    marginTop: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
