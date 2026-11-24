import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { GlassSurface, useTabBarInset } from "./glass";

export const SEARCH_BAR_HEIGHT = 48;
const GAP = 8;

/**
 * The keyboard's height while it's up, 0 when down. Android resizes the window for the keyboard,
 * so there it only reports whether it's up (1) and nothing needs to move by its height.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setHeight(ios ? e.endCoordinates.height : 1),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
      setHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** Distance from the screen's bottom edge to the bottom of the floating search bar. */
function useBarBottom() {
  const tabBarInset = useTabBarInset();
  const keyboard = useKeyboardHeight();
  if (!keyboard) return tabBarInset + GAP;
  return (Platform.OS === "ios" ? keyboard : 0) + GAP;
}

/** Bottom padding for a list scrolling under the search bar, so its last row clears it. */
export function useBottomSearchInset(extra = 0) {
  return useBarBottom() + SEARCH_BAR_HEIGHT + GAP * 2 + extra;
}

/**
 * A search field floating at the bottom of the screen, above the tab bar (or the keyboard), where
 * a thumb reaches it. Render it as the last child of a screen whose root is `flex: 1`; the
 * screen's list should pad its bottom by `useBottomSearchInset()`. `accessory` sits just above
 * the field, for things tied to what's typed (a command suggestion, an undo).
 */
export function BottomSearchBar({
  value,
  onChangeText,
  placeholder,
  inputRef,
  trailing,
  accessory,
  ...inputProps
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  /** Shown at the right end of the field, e.g. a spinner. */
  trailing?: ReactNode;
  accessory?: ReactNode;
} & Omit<TextInputProps, "value" | "onChangeText" | "placeholder" | "style">) {
  const { colors, typography } = useTheme();
  const bottom = useBarBottom();

  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
      {accessory}
      <GlassSurface style={styles.field}>
        <View style={styles.row}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            selectionColor={colors.hanko}
            cursorColor={colors.hanko}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={placeholder}
            {...inputProps}
            style={[styles.input, typography.body, { color: colors.ink }]}
          />
          {trailing}
          {value.length > 0 && (
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => onChangeText("")}
            >
              <Feather name="x-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: "absolute", left: 16, right: 16, gap: GAP },
  field: {
    height: SEARCH_BAR_HEIGHT,
    borderRadius: SEARCH_BAR_HEIGHT / 2,
    elevation: 6,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  input: { flex: 1, paddingVertical: 0 },
});
