import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "#": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
    env: { CONVEX_CLOUD_URL: "https://some-deployment.convex.cloud" },
  },
});
