import { Redirect } from "expo-router";

// The Google sign-in hand-off deep link (inkmark://auth?code=…). The auth browser
// session in src/auth.ts reads the code; if the router sees the link too (Android),
// send it back through the index auth gate.
export default function AuthReturn() {
  return <Redirect href="/" />;
}
