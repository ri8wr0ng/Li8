import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { serviceWorker } from "./vite/service-worker.ts";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    // All data is private and lives in Convex, so the app renders in the browser
    // and builds to static files (any static host / installable PWA).
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
    // Offline app shell: precaches the build and serves _shell.html for every route.
    serviceWorker(),
  ],
});

export default config;
