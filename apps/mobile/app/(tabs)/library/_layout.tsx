import { Stack } from "expo-router";
import { tabRootHeader } from "../../../src/components/profile-button";
import { useTheme } from "../../../src/theme";

export default function LibraryLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.paper,
        },
        headerTintColor: colors.ink,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: "600",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.paper,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Library",
          ...tabRootHeader,
        }}
      />
      <Stack.Screen
        name="[seriesId]"
        options={{
          title: "Series",
          headerBackTitle: "Library",
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: "Add Series",
          headerBackTitle: "Library",
        }}
      />
    </Stack>
  );
}
