import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { seo } from "./vite/seo.ts";
import { serviceWorker } from "./vite/service-worker.ts";
import { PUBLIC_PATHS } from "./src/lib/public-paths.ts";

const config = defineConfig({
  // `convex dev` (run in packages/backend) writes VITE_CONVEX_URL to its .env.local.
  envDir: fileURLToPath(new URL("../../packages/backend", import.meta.url)),
  resolve: { tsconfigPaths: true },
  server: {
    fs: {
      // Bun links packages from its global cache, outside the repo, so Vite would 403 font files.
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        process.env.BUN_INSTALL_CACHE_DIR ?? join(homedir(), ".bun", "install", "cache"),
      ],
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
      pages: PUBLIC_PATHS.map((path) => ({ path })),
      prerender: { crawlLinks: false, autoSubfolderIndex: false },
    }),
    viteReact(),
    // Offline app shell: precaches the build and serves _shell.html for every route.
    serviceWorker(),
    // robots.txt, sitemap.xml and the public origin for canonical/Open Graph URLs.
    seo(),
  ],
});

export default config;
