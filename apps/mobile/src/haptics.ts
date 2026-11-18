import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Haptics for the moments that matter: a commit, a change of selection, a
 * success, a destructive step. Kept rare so they stay meaningful. Fire them on
 * the same frame as the visual change they belong to.
 */
const run = (fn: () => Promise<void>) => {
  if (Platform.OS === "web") return;
  void fn().catch(() => {});
};

export const haptics = {
  /** A selection changed: a tab, a theme, a chip. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Something was committed: a message sent, a chapter bumped. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
