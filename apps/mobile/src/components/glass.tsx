import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useTheme } from "../theme";

type Target = RefObject<ComponentRef<typeof View> | null>;

const GlassContext = createContext<{
  target: Target | null;
  setTarget: (target: Target) => void;
}>({ target: null, setTarget: () => {} });

/** Lets the floating tab bar blur whichever tab is showing. */
export function GlassProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  return <GlassContext.Provider value={{ target, setTarget }}>{children}</GlassContext.Provider>;
}

/**
 * Wraps one tab's screen so Android can blur it behind the bar (iOS blurs
 * whatever is underneath on its own). The focused tab hands its view over.
 */
export function GlassTarget({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation: {
    isFocused: () => boolean;
    addListener: (event: "focus", cb: () => void) => () => void;
  };
}) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const { setTarget } = useContext(GlassContext);

  useEffect(() => {
    if (navigation.isFocused()) setTarget(ref);
    return navigation.addListener("focus", () => setTarget(ref));
  }, [navigation, setTarget]);

  return (
    <BlurTargetView ref={ref} style={styles.screen}>
      {children}
    </BlurTargetView>
  );
}

/**
 * Space the floating tab bar covers at the bottom of the screen (safe area included).
 * Scrolling content pads by this so its last item clears the bar.
 */
export function useTabBarInset() {
  return useBottomTabBarHeight();
}

function useReducedTransparency() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/**
 * The tab bar's material: content scrolls underneath and shows through,
 * frosted. With Reduce Transparency on it turns solid.
 */
export function TabBarGlass() {
  const { colors, isDark } = useTheme();
  const { target } = useContext(GlassContext);
  const reduced = useReducedTransparency();

  if (reduced) {
    return <View style={[styles.fill, { backgroundColor: colors.card }]} />;
  }

  return (
    <View style={styles.fill}>
      <BlurView
        style={styles.fill}
        intensity={Platform.OS === "ios" ? 80 : 60}
        tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
        blurMethod={target ? "dimezisBlurViewSdk31Plus" : "none"}
        blurTarget={target ?? undefined}
      />
      {/* A light paper wash keeps labels legible over busy content, and stands in
          for the blur on Android versions that can't do it. */}
      <View
        style={[
          styles.fill,
          { backgroundColor: isDark ? "rgba(27, 26, 23, 0.55)" : "rgba(255, 253, 249, 0.6)" },
        ]}
      />
      {/* Bright top edge, like light catching the material, instead of a hard divider. */}
      <View
        style={[
          styles.edge,
          { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(28, 26, 23, 0.06)" },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  edge: { position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
