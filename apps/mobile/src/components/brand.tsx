import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../theme";

export function BookmarkIcon({ size = 48 }: { size?: number }) {
  const { colors, radii } = useTheme();

  return (
    <View
      style={[
        styles.iconContainer,
        {
          width: size,
          height: size,
          borderRadius: radii.controls,
          backgroundColor: colors.hanko,
        },
      ]}
    >
      {/* Bookmark ribbon */}
      <View
        style={[
          styles.ribbon,
          {
            width: size * 0.42,
            height: size * 0.62,
            backgroundColor: colors.paper,
          },
        ]}
      >
        {/* Ink lines */}
        <View
          style={[
            styles.inkLine,
            {
              width: "60%",
              backgroundColor: colors.ink,
              top: size * 0.14,
            },
          ]}
        />
        <View
          style={[
            styles.inkLine,
            {
              width: "45%",
              backgroundColor: colors.ink,
              top: size * 0.22,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.wordmarkContainer}>
      <BookmarkIcon size={size} />
      <Text
        style={[
          styles.wordmarkText,
          typography.display,
          {
            color: colors.ink,
            fontSize: size * 0.72,
          },
        ]}
      >
        Inkmark
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  ribbon: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    position: "relative",
    alignItems: "center",
  },
  inkLine: {
    position: "absolute",
    height: 2,
    borderRadius: 1,
  },
  wordmarkContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wordmarkText: {
    letterSpacing: -0.5,
  },
});
