import {
  ClientOnly,
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Splash } from "#/components/brand";
import { Providers } from "#/components/providers";
import { THEME_INIT_SCRIPT } from "#/lib/theme";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "Inkmark" },
      { name: "description", content: "Notes, and where you left off." },
      // Set before first paint by THEME_INIT_SCRIPT, then kept in sync by useTheme().
      { name: "theme-color", content: "#F7F4EE" },
      { name: "color-scheme", content: "light dark" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Inkmark" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootComponent() {
  // Auth tokens live in the browser, so everything below renders client-side.
  return (
    <ClientOnly fallback={<Splash />}>
      <Providers>
        <Outlet />
      </Providers>
    </ClientOnly>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Server-only (prerendered into the shell), so React never renders a <script> on the client. */}
        <ScriptOnce>{THEME_INIT_SCRIPT}</ScriptOnce>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
