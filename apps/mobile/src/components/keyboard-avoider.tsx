import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useKeyboardHeight } from "./bottom-search-bar";

/**
 * Keeps a screen's bottom (a composer, a format toolbar) above the keyboard.
 *
 * Android draws edge to edge, so the window doesn't shrink for the keyboard, and
 * KeyboardAvoidingView under-pads there. This pads by how far the keyboard reaches above the
 * view's own bottom edge, both measured from the top of the screen. (Safe-area insets can't be
 * used to correct it: on Android their bottom grows to include the keyboard.) iOS keeps
 * KeyboardAvoidingView, which animates with the keyboard.
 */
export function KeyboardAvoider({
  style,
  iosOffset = 0,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  /** Height of anything above this view that isn't part of it, e.g. a stack header (iOS). */
  iosOffset?: number;
  children: ReactNode;
}) {
  const keyboard = useKeyboardHeight();
  const ref = useRef<ComponentRef<typeof View>>(null);
  // Space between this view's bottom edge and the screen's.
  const [below, setBelow] = useState(0);

  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView style={style} behavior="padding" keyboardVerticalOffset={iosOffset}>
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View
      ref={ref}
      onLayout={() =>
        ref.current?.measure((_x, _y, _width, height, _pageX, pageY) =>
          setBelow(Math.max(0, Dimensions.get("screen").height - (pageY + height))),
        )
      }
      style={[style, { paddingBottom: keyboard > 0 ? Math.max(0, keyboard - below) : 0 }]}
    >
      {children}
    </View>
  );
}
