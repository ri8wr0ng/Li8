import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Providers } from "../src/providers";
import { useTheme } from "../src/theme";

function RootStack() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <RootStack />
    </Providers>
  );
}
