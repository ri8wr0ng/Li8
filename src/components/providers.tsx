import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { api } from "../../convex/_generated/api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string));
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeColorSync />
      <ConvexAuthProvider
        client={client}
        api={{
          refreshSession: api.auth.refreshSession,
          signOut: api.auth.signOut,
          isAuthenticated: api.auth.isAuthenticated,
        }}
      >
        <TooltipProvider delayDuration={400}>
          {children}
          <Toaster position="top-center" />
        </TooltipProvider>
      </ConvexAuthProvider>
    </ThemeProvider>
  );
}

/** Match the browser/status bar color to the theme the user picked, not just the OS. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", resolvedTheme === "dark" ? "#131210" : "#F7F4EE");
  }, [resolvedTheme]);
  return null;
}
