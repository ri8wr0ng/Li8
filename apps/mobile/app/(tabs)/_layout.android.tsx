import { Redirect, useRouter } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { GlassProvider, GlassTarget } from "../../src/components/glass";
import { GlassTabBar, type GlassTab } from "../../src/components/glass-tab-bar";
import { useTabsGate } from "../../src/navigation";

const ALL_TABS: GlassTab[] = [
  { name: "notes", title: "Notes", icon: "file-text" },
  { name: "ask", title: "AI", icon: "message-circle" },
  { name: "library", title: "Library", icon: "book-open" },
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
 * Android: draws the web's phone navigation. A glass pill of tabs, then search
 * and Ask AI as round glass buttons. Profile lives in each header's top-left.
 */
export default function TabsLayout() {
  const router = useRouter();
  const { signedOut, showAsk } = useTabsGate();
  if (signedOut) return <Redirect href="/sign-in" />;

  const tabs = showAsk ? ALL_TABS : ALL_TABS.filter((t) => t.name !== "ask");
  const renderTabBar = (props: BottomTabBarProps) => (
    <GlassTabBar
      {...props}
      tabs={tabs}
      searchRoute="search"
      onAskAi={showAsk ? () => router.push("/ask-ai") : undefined}
    />
  );

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
        <Tabs.Screen name="search" />
      </Tabs>
    </GlassProvider>
  );
}
