import { defineConfig } from "vite-plus";

// Workspace-wide format, lint, staged-file and task-runner settings.
// Each app keeps its own build config (apps/*/vite.config.ts).
export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "**/routeTree.gen.ts",
      "**/convex/_generated/**",
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
    ignorePatterns: ["**/routeTree.gen.ts", "**/convex/_generated/**", ".agents/**", ".claude/**"],
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
  run: {
    cache: true,
  },
});
