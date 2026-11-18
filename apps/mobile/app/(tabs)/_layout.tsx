import { Tabs, Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";

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

function ProfileTabIcon({ color, size }: TabBarIconProps) {
  return <Feather name="user" size={size} color={typeof color === "string" ? color : undefined} />;
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { colors } = useTheme();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
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
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.hanko,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="notes/index"
        options={{
          title: "Notes",
          headerTitle: "Notes",
          tabBarIcon: NotesTabIcon,
        }}
      />
      <Tabs.Screen
        name="library/index"
        options={{
          title: "Library",
          headerTitle: "Library",
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
  );
}
