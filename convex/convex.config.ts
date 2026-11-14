import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config.js";
import authGoogle from "@convex-dev/auth/components/google/convex.config.js";
import agent from "@convex-dev/agent/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp({
  env: {
    AUTH_GOOGLE_CLIENT_ID: v.string(),
    AUTH_GOOGLE_CLIENT_SECRET: v.string(),
    // Deployed web app origin, allowed as an OAuth redirect target.
    SITE_URL: v.optional(v.string()),
    // OpenRouter key, used for chat (Claude) and embeddings (OpenAI).
    // AI features stay hidden until it's set.
    OPENROUTER_API_KEY: v.optional(v.string()),
  },
});

app.use(auth);

// Google redirect URI: <CONVEX_SITE_URL>/oauth/google/callback
app.use(authGoogle, {
  httpPrefix: "/oauth/google",
  env: {
    CLIENT_ID: app.env.AUTH_GOOGLE_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GOOGLE_CLIENT_SECRET,
  },
});

// Ask: chat threads, messages and streaming.
app.use(agent);
// Per-user limits on AI calls.
app.use(rateLimiter);

export default app;
