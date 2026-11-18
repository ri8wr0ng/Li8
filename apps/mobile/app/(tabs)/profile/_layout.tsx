import { Stack } from "expo-router";
import { useStackScreenOptions } from "../../../src/navigation";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: "Profile" }} />
    </Stack>
  );
}
