import { useState, type JSX } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Id } from "@inkmark/backend/convex/_generated/dataModel";
import { useTheme } from "../theme";
import { haptics } from "../haptics";

type Role = "view" | "edit";

function errorMessage(err: unknown): string {
  return err instanceof ConvexError ? String(err.data) : "Something went wrong";
}

export function ShareSheet({
  noteId,
  visible,
  onClose,
}: {
  noteId: Id<"notes">;
  visible: boolean;
  onClose: () => void;
}): JSX.Element {
  const insets = useSafeAreaInsets();
  const { colors, radii } = useTheme();

  const shares = useQuery(api.notes.shares, visible ? { id: noteId } : "skip");
  const share = useMutation(api.notes.share);
  const unshare = useMutation(api.notes.unshare);
  const setPublic = useMutation(api.notes.setPublic);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("view");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicId = shares?.publicId ?? null;
  const people = shares?.people ?? [];
  const url = publicId ? `${process.env.EXPO_PUBLIC_SITE_URL ?? ""}/s/${publicId}` : null;

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await share({ id: noteId, email: trimmed, role });
      setEmail("");
      haptics.success();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRole = async (personEmail: string, current: Role) => {
    try {
      await share({
        id: noteId,
        email: personEmail,
        role: current === "view" ? "edit" : "view",
      });
    } catch (err) {
      console.error("Failed to change role:", err);
    }
  };

  const handleRemove = async (userId: Id<"users">) => {
    try {
      await unshare({ id: noteId, userId });
    } catch (err) {
      console.error("Failed to remove share:", err);
    }
  };

  const handleCreateLink = async () => {
    try {
      await setPublic({ id: noteId, enabled: true });
    } catch (err) {
      console.error("Failed to create public link:", err);
    }
  };

  const handleTurnOff = async () => {
    try {
      await setPublic({ id: noteId, enabled: false });
    } catch (err) {
      console.error("Failed to turn off public link:", err);
    }
  };

  const handleShareLink = () => {
    if (!url) return;
    void Share.share({ message: url, url });
  };

  const roleLabel = (r: Role) => (r === "view" ? "Can view" : "Can edit");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={[styles.grabHandle, { backgroundColor: colors.border }]} />

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.ink }]}>Share note</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Feather name="x" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Invite people by the email they sign in with, or turn on a public link.
            </Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>People</Text>

              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="name@example.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.emailInput,
                  {
                    borderColor: colors.border,
                    color: colors.ink,
                    borderRadius: radii.controls,
                  },
                ]}
              />

              <View style={styles.inviteRow}>
                <View style={[styles.segmented, { borderColor: colors.border }]}>
                  {(["view", "edit"] as const).map((r) => {
                    const selected = role === r;
                    return (
                      <Pressable
                        key={r}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setRole(r)}
                        style={[
                          styles.segment,
                          {
                            backgroundColor: selected ? colors.ink : "transparent",
                            borderRadius: radii.controls - 2,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: selected ? colors.paper : colors.ink },
                          ]}
                        >
                          {roleLabel(r)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Invite"
                  disabled={!email.trim() || submitting}
                  onPress={handleInvite}
                  style={({ pressed }) => [
                    styles.inviteBtn,
                    {
                      backgroundColor: colors.hanko,
                      borderRadius: radii.controls,
                      opacity: !email.trim() || submitting ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.inviteBtnText}>Invite</Text>
                  )}
                </Pressable>
              </View>

              {error ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              ) : null}

              {shares === undefined ? (
                <ActivityIndicator style={styles.peopleLoading} color={colors.hanko} />
              ) : people.length === 0 ? (
                <Text style={[styles.emptyPeople, { color: colors.muted }]}>
                  Only you can see this note.
                </Text>
              ) : (
                people.map((person, i) => {
                  const name = person.name ?? person.email ?? "Unknown";
                  return (
                    <View
                      key={person.userId}
                      style={[
                        styles.personRow,
                        i < people.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.personInfo}>
                        <Text style={[styles.personName, { color: colors.ink }]} numberOfLines={1}>
                          {name}
                        </Text>
                        {person.email ? (
                          <Text style={[styles.personEmail, { color: colors.muted }]}>
                            {person.email}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.personActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${roleLabel(person.role)} for ${name}`}
                          disabled={!person.email}
                          onPress={() => {
                            if (person.email) {
                              void handleToggleRole(person.email, person.role);
                            }
                          }}
                          style={({ pressed }) => [
                            styles.roleChip,
                            {
                              borderColor: colors.border,
                              borderRadius: 8,
                              opacity: pressed ? 0.6 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.roleChipText, { color: colors.ink }]}>
                            {roleLabel(person.role)}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${name}`}
                          hitSlop={8}
                          onPress={() => void handleRemove(person.userId)}
                          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                        >
                          <Feather name="x" size={18} color={colors.muted} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}

              <Text style={[styles.sectionLabel, { color: colors.muted }]}>Public link</Text>

              {publicId === null ? (
                <View style={styles.publicRow}>
                  <Text style={[styles.publicHint, { color: colors.ink }]}>
                    Anyone with the link can view
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create link"
                    onPress={() => void handleCreateLink()}
                    style={({ pressed }) => [
                      styles.outlineBtn,
                      {
                        borderColor: colors.border,
                        borderRadius: radii.controls,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.outlineBtnText, { color: colors.ink }]}>Create link</Text>
                  </Pressable>
                </View>
              ) : url ? (
                <>
                  <View style={[styles.urlBox, { backgroundColor: colors.paper }]}>
                    <Text
                      style={[
                        styles.urlText,
                        {
                          color: colors.muted,
                          fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {url}
                    </Text>
                  </View>
                  <View style={styles.publicActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Share link"
                      onPress={handleShareLink}
                      style={({ pressed }) => [
                        styles.shareLinkBtn,
                        {
                          backgroundColor: colors.hanko,
                          borderRadius: radii.controls,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Feather name="share" size={16} color="#fff" />
                      <Text style={styles.shareLinkBtnText}>Share link</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Turn off"
                      onPress={() => void handleTurnOff()}
                      style={({ pressed }) => [
                        styles.outlineBtn,
                        {
                          borderColor: colors.border,
                          borderRadius: radii.controls,
                          opacity: pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.turnOffText, { color: colors.destructive }]}>
                        Turn off
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  emailInput: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  segmented: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 1,
    height: 36,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inviteBtn: {
    height: 36,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  peopleLoading: {
    marginTop: 16,
  },
  emptyPeople: {
    fontSize: 14,
    paddingVertical: 8,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: "600",
  },
  personEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  personActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roleChip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  publicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  publicHint: {
    flex: 1,
    fontSize: 14,
  },
  outlineBtn: {
    borderWidth: 1,
    height: 36,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  urlBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  urlText: {
    fontSize: 12,
  },
  publicActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  shareLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
  },
  shareLinkBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  turnOffText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
