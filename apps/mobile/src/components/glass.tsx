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
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";

/** Android's floating tab bar: a capsule this tall, floating this far above the bottom edge. */
export const GLASS_BAR_HEIGHT = 64;
export const GLASS_BAR_GAP = 12;
/** The height of iOS's own tab bar above the home indicator. */
const IOS_TAB_BAR_HEIGHT = 49;

/**
 * Space the tab bar covers at the bottom of the screen, safe area included.
 * Scrolling content and the Ask composer pad by this to clear it.
 */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "ios") return insets.bottom + IOS_TAB_BAR_HEIGHT;
  return GLASS_BAR_HEIGHT + Math.max(insets.bottom, GLASS_BAR_GAP) + GLASS_BAR_GAP;
}

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

export function useReducedTransparency() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/**
 * A piece of frosted glass: what's behind shows through, blurred, under a thin
 * wash that keeps labels legible, with a bright rim where light catches the
 * edge. With Reduce Transparency on it turns solid.
 */
export function GlassSurface({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const { target } = useContext(GlassContext);
  const reduced = useReducedTransparency();
  const radius = StyleSheet.flatten(style)?.borderRadius ?? 0;

  return (
    <View style={[styles.surface, style]}>
      {reduced ? (
        <View style={[styles.fill, { backgroundColor: colors.card }]} />
      ) : (
        <>
          <BlurView
            style={styles.fill}
            intensity={Platform.OS === "ios" ? 80 : 40}
            tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
            blurMethod={target ? "dimezisBlurViewSdk31Plus" : "none"}
            blurTarget={target ?? undefined}
          />
          <View
            style={[
              styles.fill,
              { backgroundColor: isDark ? "rgba(36, 34, 30, 0.6)" : "rgba(255, 253, 249, 0.62)" },
            ]}
          />
        </>
      )}
      <View
        pointerEvents="none"
        style={[
          styles.fill,
          styles.rim,
          {
            borderRadius: radius,
            borderColor: isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(255, 255, 255, 0.85)",
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  surface: { overflow: "hidden" },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  rim: { borderWidth: StyleSheet.hairlineWidth },
});
