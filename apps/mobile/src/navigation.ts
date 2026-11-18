import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "./theme";

/** Header look shared by every tab's stack. */
export function useStackScreenOptions() {
  const { colors } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.paper },
    headerTintColor: colors.ink,
    headerTitleStyle: { fontSize: 18, fontWeight: "600" as const },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.paper },
  };
}

/**
 * What both tab layouts (iOS native, Android custom) need: whether to send the
 * user to sign in, and whether to show Ask (only when AI is on for them, like the web).
 */
export function useTabsGate() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ai = useQuery(api.chat.status, isAuthenticated ? {} : "skip");
  return {
    signedOut: !isLoading && !isAuthenticated,
    showAsk: ai?.enabled === true,
  };
}
