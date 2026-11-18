import { useState, type ReactNode } from "react";
import { ConvexAuthProvider, type TokenStorage } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { api } from "@inkmark/backend/convex/_generated/api";
import { UpdaterProvider } from "./updates/updater";

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
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore write errors in restricted environments
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore delete errors
    }
  },
};

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(getConvexUrl()));

  return (
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
    </SafeAreaProvider>
  );
}
