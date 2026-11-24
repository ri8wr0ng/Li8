import {
  ClientOnly,
  HeadContent,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Splash } from "#/components/brand";
import { Providers } from "#/components/providers";
import { PUBLIC_PATHS } from "#/lib/public-paths";
import { DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL, TAGLINE, absoluteUrl } from "#/lib/seo";
import { THEME_INIT_SCRIPT } from "#/lib/theme";

import appCss from "../styles/index.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: HOME_TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "application-name", content: SITE_NAME },
      // Social cards. Crawlers read the prerendered shell, so these cover every URL.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: `${SITE_NAME}: ${TAGLINE}` },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: absoluteUrl("/og-image.png") },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${SITE_NAME}: ${TAGLINE}` },
      { property: "og:locale", content: "en_US" },
      ...(SITE_URL ? [{ property: "og:url", content: SITE_URL }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${SITE_NAME}: ${TAGLINE}` },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: absoluteUrl("/og-image.png") },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: SITE_NAME,
          description: DESCRIPTION,
          applicationCategory: "ProductivityApplication",
          operatingSystem: "Any",
          browserRequirements: "Requires JavaScript",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          image: absoluteUrl("/og-image.png"),
          ...(SITE_URL ? { url: SITE_URL } : {}),
        },
      },
      // Set before first paint by THEME_INIT_SCRIPT, then kept in sync by useTheme().
      { name: "theme-color", content: "#F7F4EE" },
      { name: "color-scheme", content: "light dark" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: SITE_NAME },
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
  const pathname = useLocation({ select: (location) => location.pathname.replace(/\/$/, "") });
  const isPublicPage = PUBLIC_PATHS.includes(pathname);
  return (
    <ClientOnly fallback={isPublicPage ? <Outlet /> : <Splash />}>
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
