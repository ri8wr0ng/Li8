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
        <Stack.Screen
          name="profile"
          options={{
            headerShown: true,
            title: "Profile",
            animation: "default",
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: "Settings",
            animation: "default",
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="ask-ai"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
            headerShown: true,
            title: "Ask AI",
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            headerShadowVisible: false,
          }}
        />
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
