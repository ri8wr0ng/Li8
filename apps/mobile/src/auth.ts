import { useState, useCallback } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { api } from "@inkmark/backend/convex/_generated/api";

// Ensures any pending web browser redirect is handled
WebBrowser.maybeCompleteAuthSession();

// Where the hand-off page (apps/web/public/mobile-auth.html) sends the browser back to:
// "inkmark://auth" in the app (the `scheme` in app.json), "exp://<metro>/--/auth" in Expo Go.
// Linking.createURL returns the app scheme even in Expo Go, where it would open the installed
// app instead, so build Expo Go's link from the Metro host.
const appReturnUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (isRunningInExpoGo() && hostUri) {
    return `exp://${hostUri}/--/auth`;
  }
  return "inkmark://auth";
};
// Query params Convex Auth's OAuth callback appends to the redirect (lib/oauthParams in @convex-dev/auth).
const AUTH_CODE_PARAM = "convexAuthCode";
const AUTH_ERROR_PARAM = "convexAuthError";

export function useMobileGoogleSignIn() {
  const { signIn } = useSignInWithGoogle(api.auth);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startGoogleSignIn = useCallback(async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Convex Auth only redirects to allowed http(s) origins, so Google sends the
      // browser to the web app's hand-off page (apps/web/public/mobile-auth.html),
      // which forwards ?convexAuthCode=… to the app's deep link that the auth session waits for.
      const siteUrl = process.env.EXPO_PUBLIC_SITE_URL || "http://localhost:3000";
      const returnUrl = appReturnUrl();
      const redirectTo = `${siteUrl}/mobile-auth.html?return=${encodeURIComponent(returnUrl)}`;

      const startResult = await signIn({ redirectTo });

      if (startResult.status === "error") {
        setErrorMessage("Couldn't start Google sign-in. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Open in-app browser session to authenticate with Google
      const authResult = await WebBrowser.openAuthSessionAsync(
        startResult.redirect.toString(),
        returnUrl,
      );

      if (authResult.type === "success" && authResult.url) {
        // Convex Auth's callback names its params convexAuthCode / convexAuthError.
        const { queryParams } = Linking.parse(authResult.url);
        const code = queryParams?.[AUTH_CODE_PARAM];
        const authError = queryParams?.[AUTH_ERROR_PARAM];

        if (typeof code === "string" && code) {
          const completeResult = await signIn({ code });
          if (completeResult.status === "error") {
            setErrorMessage("Authentication failed. Please try again.");
          }
        } else if (authError === "access_denied") {
          // The user declined on Google's consent screen; nothing to report.
        } else if (authError === "expired") {
          setErrorMessage("Sign-in took too long. Please try again.");
        } else {
          setErrorMessage("Sign-in completed without an authorization code.");
        }
      } else if (
        authResult.type === WebBrowser.WebBrowserResultType.CANCEL ||
        authResult.type === WebBrowser.WebBrowserResultType.DISMISS
      ) {
        // User cancelled or dismissed the in-app browser; no error message needed
      } else {
        setErrorMessage("Sign-in was interrupted. Please try again.");
      }
    } catch (err: unknown) {
      console.error("Google sign-in error on mobile:", err);
      setErrorMessage("Something went wrong during sign-in.");
    } finally {
      setIsSubmitting(false);
    }
  }, [signIn]);

  return {
    startGoogleSignIn,
    isSubmitting,
    errorMessage,
  };
}
