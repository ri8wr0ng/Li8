import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { useCachedQuery } from "../offline";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Id } from "@inkmark/backend/convex/_generated/dataModel";
import type { SeriesKind } from "@inkmark/backend/convex/validators";
import { useTheme } from "../theme";
import { KIND_OPTIONS, READ_KINDS, WATCH_KINDS } from "./series";

interface TypeFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedKinds: SeriesKind[];
  onSelectKinds: (kinds: SeriesKind[]) => void;
}

export function TypeFilterModal({
  visible,
  onClose,
  selectedKinds,
  onSelectKinds,
}: TypeFilterModalProps) {
  const { colors, radii, typography } = useTheme();

  const toggleKind = (kind: SeriesKind) => {
    if (selectedKinds.includes(kind)) {
      onSelectKinds(selectedKinds.filter((k) => k !== kind));
    } else {
      onSelectKinds([...selectedKinds, kind]);
    }
  };

  const handleSelectAllReading = () => {
    const next = Array.from(new Set([...selectedKinds, ...READ_KINDS]));
    onSelectKinds(next);
  };

  const handleSelectAllWatching = () => {
    const next = Array.from(new Set([...selectedKinds, ...WATCH_KINDS]));
    onSelectKinds(next);
  };

  const handleClear = () => {
    onSelectKinds([]);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radii.card,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, typography.display, { color: colors.ink }]}>
              Filter by type
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Feather name="x" size={20} color={colors.muted} />
            </Pressable>
          </View>

          {/* Quick presets */}
          <View style={styles.presetRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select all reading"
              onPress={handleSelectAllReading}
              style={[
                styles.presetChip,
                { borderColor: colors.border, backgroundColor: colors.surfaceHighlight },
              ]}
            >
              <Text style={[styles.presetText, { color: colors.ink }]}>All reading</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select all watching"
              onPress={handleSelectAllWatching}
              style={[
                styles.presetChip,
                { borderColor: colors.border, backgroundColor: colors.surfaceHighlight },
              ]}
            >
              <Text style={[styles.presetText, { color: colors.ink }]}>All watching</Text>
            </Pressable>
            {selectedKinds.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear type filters"
                onPress={handleClear}
                style={[
                  styles.presetChip,
                  { borderColor: colors.border, backgroundColor: colors.surfaceHighlight },
                ]}
              >
                <Text style={[styles.presetText, { color: colors.destructive }]}>Clear</Text>
              </Pressable>
            )}
          </View>

          {/* List of Types */}
          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {KIND_OPTIONS.map((item) => {
              const isSelected = selectedKinds.includes(item.value);
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => toggleKind(item.value)}
                  style={[
                    styles.itemRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: isSelected ? colors.surfaceHighlight : "transparent",
                    },
                  ]}
                >
                  <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemLabel, { color: colors.ink }]}>{item.label}</Text>
                    <Text style={[styles.itemSublabel, { color: colors.muted }]}>{item.group}</Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isSelected ? colors.hanko : colors.border,
                        backgroundColor: isSelected ? colors.hanko : "transparent",
                      },
                    ]}
                  >
                    {isSelected && <Feather name="check" size={14} color="#FFFFFF" />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onClose}
              style={[
                styles.doneButton,
                {
                  backgroundColor: colors.hanko,
                  borderRadius: radii.controls,
                },
              ]}
            >
              <Text style={[styles.doneButtonText, { color: "#FFFFFF" }]}>
                Done {selectedKinds.length > 0 ? `(${selectedKinds.length})` : ""}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface LabelFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedLabelIds: Id<"labels">[];
  onSelectLabelIds: (ids: Id<"labels">[]) => void;
}

export function LabelFilterModal({
  visible,
  onClose,
  selectedLabelIds,
  onSelectLabelIds,
}: LabelFilterModalProps) {
  const { colors, radii, typography } = useTheme();
  const labels = useCachedQuery(api.labels.list, {}) ?? [];
  const createLabel = useMutation(api.labels.create);

  const [newLabelName, setNewLabelName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const toggleLabel = (id: Id<"labels">) => {
    if (selectedLabelIds.includes(id)) {
      onSelectLabelIds(selectedLabelIds.filter((lid) => lid !== id));
    } else {
      onSelectLabelIds([...selectedLabelIds, id]);
    }
  };

  const handleCreate = async () => {
    const trimmed = newLabelName.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const id = await createLabel({ name: trimmed });
      setNewLabelName("");
      if (id) {
        onSelectLabelIds([...selectedLabelIds, id]);
      }
    } catch (err) {
      console.error("Create label error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClear = () => {
    onSelectLabelIds([]);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radii.card,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, typography.display, { color: colors.ink }]}>
              Filter by label
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Feather name="x" size={20} color={colors.muted} />
            </Pressable>
          </View>

          {/* Create new label input */}
          <View style={styles.createLabelRow}>
            <TextInput
              selectionColor={colors.hanko}
              cursorColor={colors.hanko}
              value={newLabelName}
              onChangeText={setNewLabelName}
              placeholder="Create or search label…"
              placeholderTextColor={colors.muted}
              style={[
                styles.createLabelInput,
                {
                  color: colors.ink,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceHighlight,
                  borderRadius: radii.controls,
                },
              ]}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            {newLabelName.trim().length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create label"
                disabled={isCreating}
                onPress={handleCreate}
                style={[
                  styles.createLabelBtn,
                  {
                    backgroundColor: colors.hanko,
                    borderRadius: radii.controls,
                  },
                ]}
              >
                <Text style={styles.createLabelBtnText}>Add</Text>
              </Pressable>
            )}
          </View>

          {/* Quick Clear */}
          {selectedLabelIds.length > 0 && (
            <View style={styles.presetRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear label filters"
                onPress={handleClear}
                style={[
                  styles.presetChip,
                  { borderColor: colors.border, backgroundColor: colors.surfaceHighlight },
                ]}
              >
                <Text style={[styles.presetText, { color: colors.destructive }]}>
                  Clear all selected ({selectedLabelIds.length})
                </Text>
              </Pressable>
            </View>
          )}

          {/* Labels list */}
          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {labels.length === 0 ? (
              <Text style={[styles.emptyLabelText, { color: colors.muted }]}>
                No labels yet. Type above to create one.
              </Text>
            ) : (
              labels.map((label) => {
                const isSelected = selectedLabelIds.includes(label._id);
                return (
                  <Pressable
                    key={label._id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={label.name}
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => toggleLabel(label._id)}
                    style={[
                      styles.itemRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: isSelected ? colors.surfaceHighlight : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.itemLabel, { color: colors.ink }]}>{label.name}</Text>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? colors.hanko : colors.border,
                          backgroundColor: isSelected ? colors.hanko : "transparent",
                        },
                      ]}
                    >
                      {isSelected && <Feather name="check" size={14} color="#FFFFFF" />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onClose}
              style={[
                styles.doneButton,
                {
                  backgroundColor: colors.hanko,
                  borderRadius: radii.controls,
                },
              ]}
            >
              <Text style={[styles.doneButtonText, { color: "#FFFFFF" }]}>
                Done {selectedLabelIds.length > 0 ? `(${selectedLabelIds.length})` : ""}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    borderWidth: 1,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 12,
    fontWeight: "500",
  },
  createLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  createLabelInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  createLabelBtn: {
    height: 38,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  createLabelBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  scrollList: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemSublabel: {
    fontSize: 11,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  emptyLabelText: {
    fontSize: 13,
    textAlign: "center",
    marginVertical: 20,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  doneButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
