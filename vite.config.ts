import { defineConfig, lazyPlugins } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { seo } from "./vite/seo.ts";
import { serviceWorker } from "./vite/service-worker.ts";

const config = defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "src/routeTree.gen.ts",
      "convex/_generated/**",
      "pnpm-lock.yaml",
      ".agents/**",
      ".claude/**",
    ],
  },
  lint: {
    plugins: [
      "typescript",
      "unicorn",
      "oxc",
      "react",
      "react-perf",
      "import",
      "jsx-a11y",
      "vitest",
    ],
    categories: {
      correctness: "error",
      suspicious: "warn",
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "eslint/no-underscore-dangle": "off",
      "jsx-a11y/no-autofocus": "off",
      "import/no-unassigned-import": "off",
      "vitest/require-mock-type-parameters": "off",
      "vitest/require-to-throw-message": "off",
      "jsx-a11y/prefer-tag-over-role": "off",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "react/immutability": "warn",
      "react/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    env: {
      builtin: true,
      browser: true,
    },
    ignorePatterns: ["src/routeTree.gen.ts", "convex/_generated/**", ".agents/**", ".claude/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  resolve: { tsconfigPaths: true },
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
