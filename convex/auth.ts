import { components, internal } from "./_generated/api";
import { env } from "./_generated/server";
import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupGoogle } from "@convex-dev/auth/methods/google/server";

const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;

// Set SITE_URL to the deployed web app origin: `npx convex env set SITE_URL https://...`
const allowedRedirectOrigins = ["http://localhost:3000"];
if (env.SITE_URL) allowedRedirectOrigins.push(env.SITE_URL);

export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(
  auth,
  { component: components.authGoogle, allowedRedirectOrigins },
).attachUserCallbacks({
  createUser: internal.users.createUser,
  onSignIn: internal.users.onSignIn,
});
