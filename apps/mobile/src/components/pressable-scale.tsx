import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * Critically damped spring (no overshoot), about 0.3s response: a tap carries
 * no momentum, so nothing should bounce. stiffness = (2π / response)², damping = 2√stiffness.
 */
const SPRING = { stiffness: 440, damping: 42, mass: 1, useNativeDriver: true } as const;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

type Props = Omit<PressableProps, "style" | "children"> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout for the touch target itself, e.g. `{ flex: 1 }` in a row. */
  containerStyle?: StyleProp<ViewStyle>;
  /** How far it shrinks while held. Big surfaces should move less than small buttons. */
  scale?: number;
};

/**
 * A Pressable that responds the instant a finger lands: it shrinks on press-in
 * (not on release) and springs back from wherever it is, so a quick tap or a
 * press-and-drag-away both stay continuous. With Reduce Motion on, it dims
 * instead of moving.
 */
export function PressableScale({
  style,
  containerStyle,
  scale = 0.97,
  children,
  disabled,
  ...props
}: Props) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));

  const to = (pressed: number) => {
    // Always starts from the live value, so a press mid-release just reverses.
    Animated.spring(value, { toValue: pressed, ...SPRING }).start();
  };

  const animatedStyle = reduced
    ? { opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }
    : {
        transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) }],
      };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(e) => {
        to(1);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(0);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
