import { Stack } from "expo-router";
import { ProfileButton } from "../../../src/components/profile-button";
import { useStackScreenOptions } from "../../../src/navigation";

export default function SearchLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: "Search", headerLeft: ProfileButton }} />
    </Stack>
  );
}
