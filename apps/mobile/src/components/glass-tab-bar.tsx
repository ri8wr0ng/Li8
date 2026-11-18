import { useEffect, useState } from "react";
import { Animated, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useTheme } from "../theme";
import { haptics } from "../haptics";
import { GLASS_BAR_GAP, GLASS_BAR_HEIGHT, GlassSurface } from "./glass";
import { useReducedMotion } from "./pressable-scale";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

export type GlassTab = { name: string; title: string; icon: FeatherName };

const INSET = 6;
/** Critically damped, ~0.35s: a tap carries no momentum, so the lens glides without overshoot. */
const SPRING = { stiffness: 320, damping: 36, mass: 1, useNativeDriver: true } as const;

/**
 * Android's tab bar, drawn to match the iOS one: a floating capsule of frosted
 * glass with a lens that glides to the selected tab. The lens moves on
 * touch-down, before the next screen renders, so the tap feels instant.
 */
export function GlassTabBar({
  state,
  navigateToTab,
  insets,
  tabs,
}: BottomTabBarProps & { tabs: GlassTab[] }) {
  const { colors, isDark } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const [lens] = useState(() => new Animated.Value(0));
  const keyboardUp = useKeyboardUp();

  const routes = tabs
    .map((tab) => ({ tab, route: state.routes.find((r) => r.name === tab.name) }))
    .filter((t): t is { tab: GlassTab; route: (typeof state.routes)[number] } => !!t.route);
  const focusedName = state.routes[state.index]?.name;
  const active = Math.max(
    0,
    routes.findIndex((t) => t.route.name === (pressed ?? focusedName)),
  );
  const itemWidth = routes.length ? (width - INSET * 2) / routes.length : 0;

  useEffect(() => {
    if (!itemWidth) return;
    const toValue = active * itemWidth;
    if (reduced) lens.setValue(toValue);
    // Starts from wherever the lens is, so a quick second tap just redirects it.
    else Animated.spring(lens, { toValue, ...SPRING }).start();
  }, [active, itemWidth, reduced, lens]);

  // The route has caught up with the finger; let it drive again.
  if (pressed && pressed === focusedName) setPressed(null);

  if (keyboardUp) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, GLASS_BAR_GAP) }]}
    >
      {/* Shadow on the outside, glass clipped to the capsule on the inside. */}
      <View style={[styles.bar, isDark ? styles.shadowDark : styles.shadowLight]}>
        <GlassSurface style={styles.glass}>
          <View
            style={styles.row}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            accessibilityRole="tablist"
          >
            {itemWidth > 0 && (
              <Animated.View
                style={[
                  styles.lens,
                  {
                    width: itemWidth,
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.10)"
                      : "rgba(28, 26, 23, 0.07)",
                    transform: [{ translateX: lens }],
                  },
                ]}
              />
            )}
            {routes.map(({ tab, route }, i) => {
              const selected = i === active;
              const color = selected ? colors.hanko : colors.ink;
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: route.name === focusedName }}
                  accessibilityLabel={tab.title}
                  onPressIn={() => {
                    if (route.name !== focusedName) {
                      haptics.select();
                      setPressed(route.name);
                    }
                  }}
                  onPressOut={() => {
                    // Dragged off and let go: the lens goes back where it was.
                    if (pressed === route.name && route.name !== focusedName) setPressed(null);
                  }}
                  onPress={() => navigateToTab(route.key)}
                  style={styles.item}
                >
                  <Feather name={tab.icon} size={21} color={color} />
                  <Text
                    style={[styles.label, { color }, selected && styles.labelSelected]}
                    numberOfLines={1}
                  >
                    {tab.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
      </View>
    </View>
  );
}

function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setUp(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: 440,
    height: GLASS_BAR_HEIGHT,
    borderRadius: GLASS_BAR_HEIGHT / 2,
  },
  glass: { flex: 1, borderRadius: GLASS_BAR_HEIGHT / 2 },
  shadowLight: {
    boxShadow: "0 8px 24px rgba(28, 26, 23, 0.12), 0 1px 3px rgba(28, 26, 23, 0.08)",
  },
  shadowDark: { boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)" },
  row: { flex: 1, flexDirection: "row", padding: INSET },
  lens: {
    position: "absolute",
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: (GLASS_BAR_HEIGHT - INSET * 2) / 2,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontSize: 10, fontWeight: "500", letterSpacing: 0.1 },
  labelSelected: { fontWeight: "600" },
});
