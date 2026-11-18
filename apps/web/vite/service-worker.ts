/// <reference types="node" />
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import type { Plugin } from "vite";

/**
 * Emits /sw.js into the client build.
 *
 * Hand-rolled instead of vite-plugin-pwa: TanStack Start writes the SPA shell
 * (`_shell.html`) in a prerender step *after* the client bundle is closed, so
 * Workbox's build-time manifest can't see it. All we need is "precache this
 * build's files, serve the shell for every navigation", which is ~80 lines.
 *
 * Every build gets a new version so changes to the prerendered shell and
 * public files with unchanged names also install a new worker.
 */
export function serviceWorker(): Plugin {
  let publicDir = "";
  return {
    name: "inkmark:service-worker",
    apply: "build",
    applyToEnvironment: (env) => env.name === "client",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter(
        (file) =>
          /\.(js|css)$/.test(file) ||
          // Latin subsets only; other scripts' font files are cached the first time they're used.
          /-latin-wght-normal-[\w-]+\.woff2$/.test(file),
      );
      const statics = publicDir
        ? readdirSync(publicDir).filter(
            // The social card is only fetched by link-preview crawlers, so don't precache it.
            (f) => /\.(png|svg|webmanifest|ico)$/.test(f) && f !== "og-image.png",
          )
        : [];
      const precache = ["/_shell.html", ...[...built, ...statics].map((f) => `/${f}`)].toSorted();
      const version = randomUUID();
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: SW_SOURCE.replace("__VERSION__", version).replace(
          "__PRECACHE__",
          JSON.stringify(precache),
        ),
      });
    },
  };
}

const SW_SOURCE = /* js */ `// Inkmark service worker. Generated at build time by vite/service-worker.ts.
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const SHELL = "/_shell.html";
const CACHE = "inkmark-" + VERSION;
const RUNTIME = "inkmark-runtime";

self.addEventListener("install", (event) => {
  // cache: "reload" skips the HTTP cache so a stale shell can't be precached.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))),
    ),
  );
  // No skipWaiting() here: the page asks the user before swapping versions.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("inkmark-") && key !== CACHE && key !== RUNTIME) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Convex, AniList, Google sign-in: always straight to the network.
  if (url.origin !== self.location.origin) return;
  // Mobile sign-in hand-off page (public/mobile-auth.html), not part of the SPA.
  if (url.pathname === "/mobile-auth.html") return;

  // Every route is the same SPA shell. Serve it from the cache so the app opens
  // instantly and offline; a new deploy arrives as a new worker.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(SHELL).then((cached) => cached || fetch(request)),
    );
    return;
  }

  // Hashed build assets never change: cache first, and keep any we didn't precache.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Icons and the manifest: serve what we have, refresh it in the background.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
`;
