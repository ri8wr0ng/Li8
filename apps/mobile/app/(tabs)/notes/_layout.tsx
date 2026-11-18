import { Stack } from "expo-router";
import { useTheme } from "../../../src/theme";

export default function NotesLayout() {
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
          title: "Notes",
        }}
      />
      <Stack.Screen
        name="[noteId]"
        options={{
          title: "Note",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
