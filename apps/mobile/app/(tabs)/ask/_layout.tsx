import { Stack } from "expo-router";
import { useStackScreenOptions } from "../../../src/navigation";

export default function AskLayout() {
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: "Ask" }} />
    </Stack>
  );
}
