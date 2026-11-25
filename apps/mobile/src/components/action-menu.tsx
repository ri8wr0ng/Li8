import { useEffect, useState, type ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { haptics } from "../haptics";

export type MenuItem = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  destructive?: boolean;
};

type MenuRequest = { id: number; title: string; items: MenuItem[] };

let nextId = 1;
let current: MenuRequest | null = null;
const listeners = new Set<(request: MenuRequest | null) => void>();

function emit() {
  for (const listener of listeners) listener(current);
}

/**
 * The options sheet a card opens on long-press or right-click: every action its swipes offer,
 * plus the ones that don't fit there.
 */
export const actionMenu = {
  show(title: string, items: MenuItem[]) {
    if (items.length === 0) return;
    haptics.select();
    current = { id: nextId++, title, items };
    emit();
  },
};

function hide() {
  current = null;
  emit();
}

/** Mount once near the root, after the app content. */
export function ActionMenuHost() {
  const { colors, radii, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState(current);

  useEffect(() => {
    listeners.add(setRequest);
    return () => {
      listeners.delete(setRequest);
    };
  }, []);

  const run = (item: MenuItem) => {
    hide();
    item.onPress();
  };

  return (
    <Modal
      visible={request !== null}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="slide"
      onRequestClose={hide}
    >
      <Pressable style={styles.backdrop} onPress={hide} accessibilityLabel="Close menu">
        {request ? (
          <Pressable
            key={request.id}
            accessibilityRole="menu"
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderTopLeftRadius: radii.card,
                borderTopRightRadius: radii.card,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text
              numberOfLines={1}
              style={[styles.title, typography.display, { color: colors.muted }]}
            >
              {request.title}
            </Text>
            {request.items.map((item) => {
              const tint = item.destructive ? colors.destructive : colors.ink;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  onPress={() => run(item)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderRadius: radii.controls },
                    pressed && { backgroundColor: colors.surfaceHighlight },
                  ]}
                >
                  <Feather name={item.icon} size={18} color={tint} />
                  <Text style={[styles.label, { color: tint }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.32)" },
  sheet: { borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 12, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 14, paddingHorizontal: 12, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 12, height: 50 },
  label: { fontSize: 16, fontWeight: "500" },
});
