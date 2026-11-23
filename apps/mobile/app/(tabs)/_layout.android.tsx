import { useState } from "react";
import { Redirect, usePathname, useRouter } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { useMutation } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { GlassProvider, GlassTarget } from "../../src/components/glass";
import { GlassTabBar, type GlassAction, type GlassTab } from "../../src/components/glass-tab-bar";
import { requestNewChat } from "../../src/ask/new-chat";
import { useTabsGate } from "../../src/navigation";

const ALL_TABS: GlassTab[] = [
  { name: "notes", title: "Notes", icon: "file-text" },
  {
    name: "ask",
    title: "AI",
    icon: "zap",
    ionicon: { default: "sparkles-outline", active: "sparkles" },
  },
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
 * Android: draws the web's phone navigation. A glass pill of icon tabs plus
 * Settings, then search and a create button that fits the current tab (new
 * note, add to Library, new chat). Profile is the avatar in each header.
 */
export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { signedOut, showAsk } = useTabsGate();
  const createNote = useMutation(api.notes.create);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const noteId = await createNote({});
      router.push({ pathname: "/(tabs)/notes/[noteId]", params: { noteId } });
    } catch (err) {
      console.error("Failed to create note:", err);
    } finally {
      setCreating(false);
    }
  }

  if (signedOut) return <Redirect href="/sign-in" />;

  const tabs = showAsk ? ALL_TABS : ALL_TABS.filter((t) => t.name !== "ask");
  const actionFor = (tab: string | undefined): GlassAction | undefined => {
    // On the Add form the button closes it, so it never stacks a second form.
    if (tab === "library") {
      if (pathname === "/library/new")
        return { label: "Cancel", icon: "x", onPress: () => router.back() };
      return pathname === "/library"
        ? { label: "Add to library", icon: "plus", onPress: () => router.push("/library/new") }
        : undefined;
    }
    if (tab === "ask") return { label: "New chat", icon: "plus", onPress: requestNewChat };
    return {
      label: "New note",
      icon: "edit-3",
      onPress: () => void handleCreate(),
      busy: creating,
    };
  };
  const renderTabBar = (props: BottomTabBarProps) => (
    <GlassTabBar
      {...props}
      tabs={tabs}
      searchRoute="search"
      action={actionFor(props.state.routes[props.state.index]?.name)}
      onSettings={() => router.push("/settings")}
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
