import { useEffect } from "react";

/** Lets the Android bottom bar's "New chat" button reach the AI screen's state. */
const listeners = new Set<() => void>();

export function requestNewChat() {
  for (const listener of listeners) listener();
}

/** `onNewChat` should be stable (a state setter or a useCallback). */
export function useNewChatRequest(onNewChat: () => void) {
  useEffect(() => {
    listeners.add(onNewChat);
    return () => {
      listeners.delete(onNewChat);
    };
  }, [onNewChat]);
}
