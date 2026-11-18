import { useColorScheme } from "react-native";

export const colors = {
  light: {
    paper: "#F7F4EE",
    card: "#FFFDF9",
    ink: "#1C1A17",
    muted: "#6E675C",
    border: "#E3DDD1",
    hanko: "#E5412D",
    marker: "#FFE066",
    markerActive: "#FF9F1C",
    destructive: "#DC2626",
    surfaceHighlight: "#EFECE4",
  },
  dark: {
    paper: "#131210",
    card: "#1B1A17",
    ink: "#EEE9E0",
    muted: "#9D968A",
    border: "#2C2A26",
    hanko: "#FF5A43",
    marker: "rgba(255, 214, 10, 0.34)",
    markerActive: "#FFB020",
    destructive: "#EF4444",
    surfaceHighlight: "#24221E",
  },
} as const;

export type ColorTheme = typeof colors.light;

export const radii = {
  controls: 12,
  card: 16,
  full: 9999,
} as const;

export const typography = {
  display: {
    fontWeight: "600" as const,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
  },
  number: {
    fontVariant: ["tabular-nums" as const],
    fontWeight: "600" as const,
  },
} as const;

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeColors = isDark ? colors.dark : colors.light;

  return {
    isDark,
    colors: themeColors,
    radii,
    typography,
  };
}
