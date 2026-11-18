import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";
import { GlassProvider, GlassTarget, TabBarGlass } from "../../src/components/glass";
import { haptics } from "../../src/haptics";

type TabBarIconProps = {
  color: unknown;
  size: number;
};

function NotesTabIcon({ color, size }: TabBarIconProps) {
  return (
    <Feather name="file-text" size={size} color={typeof color === "string" ? color : undefined} />
  );
}

function LibraryTabIcon({ color, size }: TabBarIconProps) {
  return (
    <Feather name="book-open" size={size} color={typeof color === "string" ? color : undefined} />
  );
}

function AskTabIcon({ color, size }: TabBarIconProps) {
  return (
    <Feather
      name="message-circle"
      size={size}
      color={typeof color === "string" ? color : undefined}
    />
  );
}

function ProfileTabIcon({ color, size }: TabBarIconProps) {
  return <Feather name="user" size={size} color={typeof color === "string" ? color : undefined} />;
}

function GlassScreenLayout({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: React.ComponentProps<typeof GlassTarget>["navigation"];
}) {
  return <GlassTarget navigation={navigation}>{children}</GlassTarget>;
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { colors } = useTheme();
  // Ask only shows when AI is set up and allowed for this account, like on the web.
  const ai = useQuery(api.chat.status, isAuthenticated ? {} : "skip");

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <GlassProvider>
      <Tabs
        screenLayout={GlassScreenLayout}
        screenListeners={{ tabPress: () => haptics.select() }}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.paper,
            shadowColor: "transparent",
            elevation: 0,
          },
          headerTitleStyle: {
            color: colors.ink,
            fontSize: 18,
            fontWeight: "600",
            letterSpacing: -0.3,
          },
          // A floating, frosted bar: content scrolls underneath it instead of stopping at a divider.
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "transparent",
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarBackground: TabBarGlass,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "500", letterSpacing: 0.1 },
          tabBarActiveTintColor: colors.hanko,
          tabBarInactiveTintColor: colors.muted,
        }}
      >
        <Tabs.Screen
          name="notes"
          options={{
            title: "Notes",
            headerShown: false,
            tabBarIcon: NotesTabIcon,
          }}
        />
        <Tabs.Screen
          name="ask/index"
          options={{
            title: "Ask",
            headerTitle: "Ask",
            tabBarIcon: AskTabIcon,
            href: ai?.enabled ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            headerShown: false,
            tabBarIcon: LibraryTabIcon,
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            title: "Profile",
            headerTitle: "Profile",
            tabBarIcon: ProfileTabIcon,
          }}
        />
      </Tabs>
    </GlassProvider>
  );
}
