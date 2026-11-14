import { useOauth, useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Splash, Wordmark } from "#/components/brand";
import { Button } from "#/components/ui/button";
import { clearCache } from "#/lib/offline";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) return <Splash />;
  if (isAuthenticated) return <Navigate to="/" />;
  return <SignedOut />;
}

function flowErrorMessage(error: ReturnType<typeof useOauth>["flowError"]) {
  if (error === null) return null;
  switch (error.error) {
    case "ACCESS_DENIED":
      return "Sign-in was cancelled.";
    case "EXPIRED":
      return "That took too long. Please try again.";
    case "INVALID_FLOW":
      return "This sign-in can't be completed here. Please try again.";
    case "OTHER_ERROR":
      console.error("Google sign-in failed:", error.cause);
      return "Something went wrong. Please try again.";
    default:
      error satisfies never;
      return "Something went wrong. Please try again.";
  }
}

function SignedOut() {
  const { signIn } = useSignInWithGoogle(api.auth);
  const { flowError } = useOauth();
  const [startError, setStartError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const error = startError ?? flowErrorMessage(flowError);

  // Signed out (or the session was revoked elsewhere): drop the offline copy.
  useEffect(() => {
    void clearCache();
  }, []);

  async function start() {
    setStartError(null);
    setPending(true);
    const result = await signIn();
    if (result.status === "redirect") return;
    setPending(false);
    if (result.status === "error") {
      console.error("Google sign-in failed to start:", result.userError);
      setStartError("Couldn't reach Google sign-in. Please try again.");
    }
  }

  return (
    <main className="pt-safe pb-safe grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="flex flex-col justify-between gap-12 px-6 py-8 sm:px-12 lg:py-12">
        <Wordmark />

        <div className="max-w-md">
          <h1 className="font-display text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
            Notes, and where you <span className="text-hanko italic">left off.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground text-pretty">
            Write things down, find them in a keystroke, and never lose your place in a series
            again. Type <Kbd>btth 349</Kbd> and you're done.
          </p>

          <Button
            size="lg"
            variant="outline"
            className="mt-9 h-12 w-full gap-3 rounded-xl text-[0.95rem] sm:w-auto sm:px-6"
            onClick={start}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <GoogleLogo />}
            Continue with Google
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Your notes sync across every device you sign in on.
        </p>
      </section>

      <Showcase />
    </main>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </kbd>
  );
}

/** A static preview of the product, not interactive. */
function Showcase() {
  return (
    <section
      aria-hidden
      className="relative hidden overflow-hidden border-l bg-secondary/60 lg:flex lg:items-center lg:justify-center"
    >
      <div className="w-[min(26rem,80%)] space-y-4">
        <div className="rotate-[-1.5deg] rounded-2xl border bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(28,26,23,0.25)]">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Manhua <span className="size-1 rounded-full bg-border" /> Reading
          </div>
          <div className="mt-2 font-display text-xl font-semibold tracking-tight">
            Battle Through The Heavens
          </div>
          <div className="text-sm text-muted-foreground">BTTH · 斗破苍穹</div>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="text-[0.7rem] font-medium tracking-widest text-muted-foreground uppercase">
                Chapter
              </div>
              <div className="font-mono text-5xl leading-none font-semibold tabular-nums">348</div>
            </div>
            <span className="grid size-12 place-items-center rounded-full bg-hanko text-hanko-foreground">
              <Plus className="size-6" />
            </span>
          </div>
        </div>

        <div className="translate-x-8 rotate-[1deg] rounded-2xl border bg-card p-5 shadow-[0_12px_32px_-16px_rgba(28,26,23,0.25)]">
          <div className="font-display text-lg font-semibold tracking-tight">Japan trip</div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Book the ryokan in Kyoto before March. Rail pass covers the <mark>Shinkansen</mark>, not
            the Nozomi trains…
          </p>
        </div>
      </div>
    </section>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
