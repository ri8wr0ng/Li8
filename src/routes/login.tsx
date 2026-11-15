import { useOauth, useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { Loader2, Search } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Splash, Wordmark } from "#/components/brand";
import { Button } from "#/components/ui/button";
import { clearCache } from "#/lib/offline";
import { cn } from "#/lib/utils";
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
    <main className="pt-safe pb-safe flex min-h-dvh flex-col">
      {/* Same column as the content below, so the logo lines up with the headline. */}
      <header className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-10 sm:pt-8">
        <Wordmark />
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-16">
        <section className="max-w-xl">
          <h1 className="font-display text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-[4.25rem]">
            Remember where you left off.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground text-pretty">
            Inkmark is a notebook and a reading tracker in one. Type a title and a chapter, and it
            keeps your place in every manga, novel and show you follow.
          </p>

          <Button
            size="lg"
            variant="outline"
            className="mt-9 h-12 w-full gap-3 rounded-xl bg-card text-[0.95rem] sm:w-auto sm:px-6"
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

          <ul className="mt-12 grid gap-4 sm:grid-cols-3 sm:gap-6">
            <Point title="Notes that save as you type">
              No save button, no folders to file into.
            </Point>
            <Point title="One search for everything">
              <Kbd>{isMac ? "⌘" : "Ctrl"} K</Kbd> finds notes and series by title or meaning.
            </Point>
            <Point title="Works offline">Installs like an app and syncs when you reconnect.</Point>
          </ul>
        </section>

        <LiveDemo />
      </div>
    </main>
  );
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <p className="font-display font-semibold tracking-[-0.01em]">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </kbd>
  );
}

type Example = { command: string; title: string; meta: string; unit: string; from: number };

const EXAMPLES: Example[] = [
  {
    command: "btth 349",
    title: "Battle Through The Heavens",
    meta: "Manhua, in progress",
    unit: "Chapter",
    from: 348,
  },
  {
    command: "frieren 12",
    title: "Frieren: Beyond Journey's End",
    meta: "Anime, season 2",
    unit: "Episode",
    from: 11,
  },
  {
    command: "orv 201",
    title: "Omniscient Reader's Viewpoint",
    meta: "Manhwa, in progress",
    unit: "Chapter",
    from: 200,
  },
];

type Phase = "typing" | "stamped";

/**
 * The product's one trick, played out: a quick-add command types itself, the
 * chapter rolls over and a hanko seal marks the card. Decorative, so hidden
 * from assistive tech; reduced motion shows the finished state and holds.
 */
function LiveDemo() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const example = EXAMPLES[index];

  useEffect(() => {
    if (reduced) return undefined;
    const timer =
      phase === "typing"
        ? typed < example.command.length
          ? setTimeout(() => setTyped((n) => n + 1), typed === 0 ? 700 : 85)
          : setTimeout(() => setPhase("stamped"), 450)
        : setTimeout(() => {
            setIndex((i) => (i + 1) % EXAMPLES.length);
            setTyped(0);
            setPhase("typing");
          }, 2800);
    return () => clearTimeout(timer);
  }, [reduced, phase, typed, example.command.length]);

  const stamped = reduced || phase === "stamped";
  const shown = reduced ? example.command : example.command.slice(0, typed);
  const to = example.from + 1;

  return (
    <section aria-hidden className="relative mx-auto w-full max-w-[30rem] select-none lg:mx-0">
      {/* The search bar the command is typed into. */}
      <div className="flex h-14 items-center gap-3 rounded-2xl border bg-card px-4 shadow-[0_1px_0_rgb(28_26_23/0.04),0_18px_40px_-24px_rgb(28_26_23/0.35)]">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-[0.95rem]">
          {shown}
          {!stamped && (
            <span className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[0.15em] animate-pulse bg-hanko" />
          )}
        </span>
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground transition-opacity duration-200",
            shown.length === example.command.length ? "opacity-100" : "opacity-0",
          )}
        >
          Enter
        </span>
      </div>

      {/* The series card it updates. */}
      <div className="relative mt-4 overflow-hidden rounded-[1.25rem] border bg-card p-6 sm:p-7">
        <p className="text-sm text-muted-foreground">{example.meta}</p>
        <p className="mt-1 max-w-[16rem] font-display text-2xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:max-w-[18rem]">
          {example.title}
        </p>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{example.unit}</p>
            <div className="relative mt-1 h-[3.75rem] overflow-hidden font-mono text-[3.75rem] leading-none font-semibold tracking-[-0.04em] tabular-nums">
              {!(stamped && reduced) && (
                <span
                  key={`${index}-from-${String(stamped)}`}
                  className={cn(
                    "absolute inset-0",
                    stamped && "animate-[roll-out_380ms_cubic-bezier(0.32,0.72,0,1)_forwards]",
                  )}
                >
                  {example.from}
                </span>
              )}
              {stamped && (
                <span
                  key={`${index}-to`}
                  className={cn(
                    "absolute inset-0",
                    !reduced && "animate-[roll-in_380ms_cubic-bezier(0.32,0.72,0,1)_both]",
                  )}
                >
                  {to}
                </span>
              )}
              {/* Reserves the width of the wider number. */}
              <span className="invisible">{to}</span>
            </div>
          </div>
          <p className="pb-1 text-right text-sm text-muted-foreground">
            {stamped ? "Saved just now" : "Last read yesterday"}
          </p>
        </div>

        {/* The seal. */}
        {stamped && (
          <span
            key={`${index}-seal`}
            className={cn(
              "absolute top-5 right-5 grid size-[4.5rem] -rotate-8 place-items-center rounded-full border-[3px] border-hanko text-hanko",
              !reduced && "animate-[stamp-press_420ms_cubic-bezier(0.2,0.9,0.3,1.2)_both]",
            )}
          >
            <span className="text-center leading-none">
              <span className="block font-mono text-lg font-bold tabular-nums">{to}</span>
              <span className="mt-0.5 block text-[0.6rem] font-semibold">saved</span>
            </span>
          </span>
        )}
      </div>

      {/* A note: the other half of the app, kept quieter. */}
      <div className="mt-4 ml-8 rounded-[1.25rem] border bg-card/70 p-5">
        <p className="font-display font-semibold tracking-[-0.01em]">Japan trip</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Book the ryokan in Kyoto before March. Rail pass covers the{" "}
          <mark className="rounded-sm bg-marker px-0.5 text-marker-foreground">Shinkansen</mark>,
          not the Nozomi…
        </p>
      </div>
    </section>
  );
}

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
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
