import { Stack } from "expo-router";
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
          fontWeight: "600",
        },
        contentStyle: {
          backgroundColor: colors.paper,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Library",
          headerShown: false,
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
