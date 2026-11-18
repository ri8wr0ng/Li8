import { Redirect } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { GlassProvider, GlassTarget } from "../../src/components/glass";
import { GlassTabBar, type GlassTab } from "../../src/components/glass-tab-bar";
import { useTabsGate } from "../../src/navigation";

const ALL_TABS: GlassTab[] = [
  { name: "notes", title: "Notes", icon: "file-text" },
  { name: "ask", title: "Ask", icon: "message-circle" },
  { name: "library", title: "Library", icon: "book-open" },
  { name: "profile", title: "Profile", icon: "user" },
];

function GlassScreenLayout({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: React.ComponentProps<typeof GlassTarget>["navigation"];
}) {
  return <GlassTarget navigation={navigation}>{children}</GlassTarget>;
}

/**
 * Android: Android has no system tab bar that looks like iOS's, so this draws
 * one. A floating glass capsule over the content, matching the iOS layout.
 */
export default function TabsLayout() {
  const { signedOut, showAsk } = useTabsGate();
  if (signedOut) return <Redirect href="/sign-in" />;

  const tabs = showAsk ? ALL_TABS : ALL_TABS.filter((t) => t.name !== "ask");
  const renderTabBar = (props: BottomTabBarProps) => <GlassTabBar {...props} tabs={tabs} />;

  return (
    <GlassProvider>
      <Tabs
        screenLayout={GlassScreenLayout}
        tabBar={renderTabBar}
        screenOptions={{ headerShown: false, tabBarStyle: { position: "absolute" } }}
      >
        <Tabs.Screen name="notes" />
        <Tabs.Screen name="ask" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </GlassProvider>
  );
}
