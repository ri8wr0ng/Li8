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
          title: "Notes",
          headerShown: false,
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
