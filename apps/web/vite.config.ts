import { fileURLToPath } from "node:url";
import { defineConfig, lazyPlugins } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { seo } from "./vite/seo.ts";
import { serviceWorker } from "./vite/service-worker.ts";

const config = defineConfig({
  // `convex dev` (run in packages/backend) writes VITE_CONVEX_URL to its .env.local.
  envDir: fileURLToPath(new URL("../../packages/backend", import.meta.url)),
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
  },
  plugins: lazyPlugins(() => [
    tailwindcss(),
    // All data is private and lives in Convex, so the app renders in the browser
    // and builds to static files (any static host / installable PWA).
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
    // Offline app shell: precaches the build and serves _shell.html for every route.
    serviceWorker(),
    // robots.txt, sitemap.xml and the public origin for canonical/Open Graph URLs.
    seo(),
  ]),
});

export default config;
