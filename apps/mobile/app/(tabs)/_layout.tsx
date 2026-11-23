import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useTheme } from "../../src/theme";
import { useTabsGate } from "../../src/navigation";
import { haptics } from "../../src/haptics";

/**
 * iOS: the system tab bar, so it gets Apple's own material, minimize behavior
 * and accessibility for free, with search as its own round button. Profile
 * lives in each header's top-left. Android uses _layout.android.tsx, a custom
 * bar drawn to match.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { signedOut, showAsk } = useTabsGate();

  if (signedOut) return <Redirect href="/sign-in" />;

  return (
    <NativeTabs
      tintColor={colors.hanko}
      minimizeBehavior="onScrollDown"
      screenListeners={{ tabPress: () => haptics.select() }}
    >
      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ask" hidden={!showAsk}>
        <NativeTabs.Trigger.Icon sf="sparkles" />
        <NativeTabs.Trigger.Label>AI</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon
          sf={{ default: "books.vertical", selected: "books.vertical.fill" }}
        />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* Search is its own round glass button beside the bar, Apple's way. */}
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
