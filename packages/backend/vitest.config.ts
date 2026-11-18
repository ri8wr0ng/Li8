import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    env: { CONVEX_CLOUD_URL: "https://some-deployment.convex.cloud" },
  },
});
