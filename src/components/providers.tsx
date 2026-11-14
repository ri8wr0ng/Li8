import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "#/components/ui/sonner";
import { TooltipProvider } from "#/components/ui/tooltip";
import { api } from "../../convex/_generated/api";
// Starts listening for `beforeinstallprompt` as early as possible.
import "#/lib/install";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string));
  useServiceWorker();
  return (
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
        <Toaster
          position="top-center"
          offset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        />
      </TooltipProvider>
    </ConvexAuthProvider>
  );
}

/**
 * Register /sw.js (production builds only; see vite/service-worker.ts) and
 * offer a reload when a new version has been downloaded.
 */
function useServiceWorker() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    function offerUpdate(worker: ServiceWorker) {
      toast("A new version of Inkmark is ready", {
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
            worker.postMessage("SKIP_WAITING");
          },
        },
      });
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Only an *update* needs a prompt; the first install has nothing to replace.
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller)
              offerUpdate(worker);
          });
        });
        // Installed apps can stay open for days; check when they come back to the foreground.
        const check = () =>
          document.visibilityState === "visible" && void reg.update().catch(() => {});
        document.addEventListener("visibilitychange", check);
      })
      .catch((err: unknown) => console.warn("Service worker registration failed", err));
  }, []);
}
