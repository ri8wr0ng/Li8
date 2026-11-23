import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useTheme } from "../theme";
import { haptics } from "../haptics";
import { GLASS_BAR_GAP, GLASS_BAR_HEIGHT, GlassSurface } from "./glass";
import { PressableScale, useReducedMotion } from "./pressable-scale";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

export type GlassTab = { name: string; title: string; icon: FeatherName };

const INSET = 5;
/** Tabs are square: as wide as they are tall, so the lit lens is a circle. */
const ITEM_WIDTH = GLASS_BAR_HEIGHT - INSET * 2;
/** Critically damped, ~0.35s: a tap carries no momentum, so the lens glides without overshoot. */
const SPRING = { stiffness: 320, damping: 36, mass: 1, useNativeDriver: true } as const;

/**
 * Android's navigation, matching the web's phone bar: a glass pill of tabs whose
 * lit lens glides to the current one, then search and New note as round glass
 * buttons beside it. The lens moves on touch-down, before the next screen
 * renders, so a tap feels instant.
 */
export function GlassTabBar({
  state,
  navigateToTab,
  insets,
  tabs,
  searchRoute,
  onCreate,
  creating,
}: BottomTabBarProps & {
  tabs: GlassTab[];
  searchRoute: string;
  onCreate?: () => void;
  creating?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState<string | null>(null);
  const [lens] = useState(() => new Animated.Value(0));
  const keyboardUp = useKeyboardUp();

  const routes = tabs
    .map((tab) => ({ tab, route: state.routes.find((r) => r.name === tab.name) }))
    .filter((t): t is { tab: GlassTab; route: (typeof state.routes)[number] } => !!t.route);
  const focusedName = state.routes[state.index]?.name;
  const current = pressed ?? focusedName;
  const active = routes.findIndex((t) => t.route.name === current);
  const search = state.routes.find((r) => r.name === searchRoute);
  const searchActive = focusedName === searchRoute;

  useEffect(() => {
    if (active < 0) return;
    const toValue = active * ITEM_WIDTH;
    if (reduced) lens.setValue(toValue);
    // Starts from wherever the lens is, so a quick second tap just redirects it.
    else Animated.spring(lens, { toValue, ...SPRING }).start();
  }, [active, reduced, lens]);

  // The route has caught up with the finger; let it drive again.
  if (pressed && pressed === focusedName) setPressed(null);

  if (keyboardUp) return null;

  const shadow = isDark ? styles.shadowDark : styles.shadowLight;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, GLASS_BAR_GAP) }]}
    >
      {/* Tabs. Shadow on the outside, glass clipped to the pill on the inside. */}
      <View style={[styles.pill, shadow, { width: routes.length * ITEM_WIDTH + INSET * 2 }]}>
        <GlassSurface style={styles.pillGlass}>
          <View style={styles.row} accessibilityRole="tablist">
            {active >= 0 && (
              <Animated.View
                style={[
                  styles.lens,
                  {
                    // The lit lens: warm hanko gradient, like the web's active tab.
                    experimental_backgroundImage: `linear-gradient(135deg, ${colors.hanko}, #F08A3C)`,
                    transform: [{ translateX: lens }],
                  },
                ]}
              />
            )}
            {routes.map(({ tab, route }, i) => {
              const selected = i === active;
              const color = selected ? "#FFFFFF" : colors.muted;
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
                  <Feather name={tab.icon} size={20} color={color} />
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

      {search && (
        <RoundGlassButton
          label="Search"
          icon={
            <Feather name="search" size={21} color={searchActive ? colors.hanko : colors.ink} />
          }
          shadow={shadow}
          onPress={() => {
            if (!searchActive) haptics.select();
            navigateToTab(search.key);
          }}
        />
      )}
      {onCreate && (
        <RoundGlassButton
          label="New note"
          icon={
            creating ? (
              <ActivityIndicator size="small" color={colors.hanko} />
            ) : (
              <Feather name="edit-3" size={20} color={colors.hanko} />
            )
          }
          shadow={shadow}
          onPress={() => {
            if (creating) return;
            haptics.tap();
            onCreate();
          }}
        />
      )}
    </View>
  );
}

function RoundGlassButton({
  label,
  icon,
  shadow,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  shadow: object;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scale={0.92}
      onPress={onPress}
      style={[styles.round, shadow]}
    >
      <GlassSurface style={styles.roundGlass}>
        <View style={styles.roundIcon}>{icon}</View>
      </GlassSurface>
    </PressableScale>
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

const RADIUS = GLASS_BAR_HEIGHT / 2;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  pill: { height: GLASS_BAR_HEIGHT, borderRadius: RADIUS },
  pillGlass: { flex: 1, borderRadius: RADIUS },
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
    width: ITEM_WIDTH,
    borderRadius: RADIUS - INSET,
  },
  item: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: "500" },
  labelSelected: { fontWeight: "700" },
  round: { width: GLASS_BAR_HEIGHT, height: GLASS_BAR_HEIGHT, borderRadius: RADIUS },
  roundGlass: { flex: 1, borderRadius: RADIUS },
  roundIcon: { flex: 1, alignItems: "center", justifyContent: "center" },
});
