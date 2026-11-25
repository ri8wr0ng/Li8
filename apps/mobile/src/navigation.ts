import { useEffect } from "react";
import { useCachedQuery, useSessionGate } from "./offline";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "./theme";
import { getItem, setItemAsync } from "./storage";

const AI_KEY = "inkmark.aiEnabled";

/**
 * The last AI access answer, read synchronously at startup so the tab bar is
 * drawn at its final size on the first frame instead of growing once
 * `chat.status` comes back (the web does the same with its offline cache).
 */
let lastAiEnabled = readAiEnabled();

function readAiEnabled() {
  try {
    return getItem(AI_KEY) === "1";
  } catch {
    return false;
  }
}

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
  const gate = useSessionGate();
  const ai = useCachedQuery(api.chat.status, {});
  const live = ai?.enabled;

  useEffect(() => {
    if (live === undefined || live === lastAiEnabled) return;
    lastAiEnabled = live;
    void setItemAsync(AI_KEY, live ? "1" : "0").catch(() => {});
  }, [live]);

  return {
    // Opened offline with a saved copy counts as signed in (read-only until Convex confirms).
    signedOut: gate === "signed-out",
    // Until the live answer arrives, keep the last one so the bar doesn't resize.
    showAsk: live ?? lastAiEnabled,
  };
}
