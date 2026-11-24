import { useState, type ReactNode } from "react";
import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { api } from "@inkmark/backend/convex/_generated/api";
import { loadThemePreference } from "./theme-preference";
import { DialogHost } from "./components/dialog";
import { UpdaterProvider } from "./updates/updater";
import { deleteItemAsync, getItemAsync, setItemAsync } from "./storage";

void loadThemePreference();

function getConvexUrl(): string {
  const url = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!url) {
    return "https://placeholder-domain.convex.cloud";
  }
  return url;
}

export const secureStorage: TokenStorage = {
  getItem: async (key: string) => {
    try {
      return await getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await setItemAsync(key, value);
    } catch {
      // ignore write errors in restricted environments
    }
  },
  removeItem: async (key: string) => {
    try {
      await deleteItemAsync(key);
    } catch {
      // ignore delete errors
    }
  },
};

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(getConvexUrl()));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConvexAuthProvider
          client={client}
          storage={secureStorage}
          api={{
            refreshSession: api.auth.refreshSession,
            signOut: api.auth.signOut,
            isAuthenticated: api.auth.isAuthenticated,
          }}
        >
          <UpdaterProvider>{children}</UpdaterProvider>
        </ConvexAuthProvider>
        <DialogHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
