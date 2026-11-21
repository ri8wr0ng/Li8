import { useOauth, useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { ClientOnly, Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark } from "#/components/brand";
import { Button } from "#/components/ui/button";
import { clearCache } from "#/lib/offline";
import { HOME_TITLE, SITE_NAME, SITE_URL, absoluteUrl } from "#/lib/seo";
import { api } from "@inkmark/backend/convex/_generated/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      ...(SITE_URL ? [{ property: "og:url", content: absoluteUrl("/login") }] : []),
    ],
    links: SITE_URL ? [{ rel: "canonical", href: absoluteUrl("/login") }] : [],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <ClientOnly fallback={<Landing signIn={<GoogleButton pending />} />}>
      <AuthLanding />
    </ClientOnly>
  );
}

function AuthLanding() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isAuthenticated) return <Navigate to="/" />;
  return <Landing signIn={isLoading ? <GoogleButton pending /> : <SignIn />} />;
}

/** The public page: what the app is, how to sign in, and the policy links. */
function Landing({ signIn }: { signIn: ReactNode }) {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col">
      {/* Same column as the content below, so the logo lines up with the headline. */}
      <header className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-10 sm:pt-8">
        <Wordmark />
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-16">
        <section className="max-w-xl">
          <h1 className="font-display text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-[4.25rem]">
            Remember where you left off.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground text-pretty">
            {SITE_NAME} is a private notebook and a tracker for manga, novels, anime, and TV. Type a
            title and a chapter or episode to save your place.
          </p>

          <div className="mt-9">{signIn}</div>

          <ul className="mt-12 space-y-3 text-[0.95rem] leading-relaxed">
            <Point title="Track progress.">
              Each series keeps its current chapter or episode and a history of when you read it.
            </Point>
            <Point title="Write notes.">
              Notes save as you type, so you can close them and pick up later.
            </Point>
            <Point title="Find anything.">
              Search notes and series together. After syncing, you can browse them offline.
            </Point>
          </ul>
        </section>

        <NotebookExample />
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 pt-4 pb-8 text-sm text-muted-foreground sm:px-10">
        <span className="mr-auto">{SITE_NAME}</span>
        <nav aria-label="Legal and help" className="flex flex-wrap gap-x-5 gap-y-2">
          <FooterLink to="/privacy">Privacy policy</FooterLink>
          <FooterLink to="/terms">Terms of service</FooterLink>
          <FooterLink to="/support">Support</FooterLink>
        </nav>
      </footer>
    </div>
  );
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

/** The Google button and its errors; the only part of the page that talks to auth. */
function SignIn() {
  const { signIn } = useSignInWithGoogle(api.auth);
  const { flowError } = useOauth();
  const [startError, setStartError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const error = startError ?? flowErrorMessage(flowError);

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
    <>
      <GoogleButton pending={pending} onClick={start} />
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

function GoogleButton({ pending, onClick }: { pending: boolean; onClick?: () => void }) {
  return (
    <Button
      size="lg"
      variant="outline"
      className="h-12 w-full gap-3 rounded-xl bg-card text-[0.95rem] shadow-[0_1px_0_rgb(28_26_23/0.04),0_10px_24px_-18px_rgb(28_26_23/0.45)] sm:w-auto sm:px-6"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
    >
      {pending && onClick ? <Loader2 className="motion-safe:animate-spin" /> : <GoogleLogo />}
      Continue with Google
    </Button>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="max-w-[34rem] text-muted-foreground">
      <span className="font-display font-semibold tracking-[-0.01em] text-foreground">{title}</span>{" "}
      {children}
    </li>
  );
}

function FooterLink({
  to,
  children,
}: {
  to: "/privacy" | "/terms" | "/support";
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

/** Page ruling that lines up with a 1.75rem line height. */
const RULED =
  "bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(1.75rem-1px),color-mix(in_oklab,var(--border)_85%,transparent)_calc(1.75rem-1px),color-mix(in_oklab,var(--border)_85%,transparent)_1.75rem)]";

/**
 * An open notebook showing the app's two halves: the left page is a series
 * with its chapter log, the right page is a note. The red ribbon marks the
 * place, as in the logo. On load the ribbon drops in and the chapter rolls
 * from 348 to 349, once; with reduced motion it renders the finished state.
 * The content is real text, so it reads the same without the animation.
 */
function NotebookExample() {
  return (
    <figure className="relative mx-auto w-full max-w-[36rem] lg:mx-0 lg:justify-self-end">
      <figcaption className="sr-only">
        An example: Battle Through the Heavens updated to chapter 349, next to a short note about
        it.
      </figcaption>

      <div className="relative grid overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_rgb(28_26_23/0.04),0_30px_60px_-36px_rgb(28_26_23/0.45)] sm:grid-cols-2">
        {/* The spine: a soft fold between the pages, when they sit side by side. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-10 -translate-x-1/2 sm:block bg-[linear-gradient(to_right,transparent,rgb(28_26_23/0.07)_50%,transparent)] dark:opacity-60"
        />

        {/* Left page: the series. */}
        <div className="relative px-6 pt-7 pb-6 sm:px-7 sm:pt-8 sm:pb-7">
          <p className="text-sm text-muted-foreground">Manhua, reading</p>
          <p className="mt-1 max-w-[12rem] font-display text-[1.45rem] leading-tight font-semibold tracking-[-0.025em] text-balance">
            Battle Through the Heavens
          </p>

          <p className="mt-7 text-sm text-muted-foreground">Chapter</p>
          <div className="relative mt-1 h-16 overflow-hidden font-mono text-[4rem] leading-none font-semibold tracking-[-0.04em] tabular-nums">
            <span
              aria-hidden
              className="absolute inset-0 opacity-0 motion-safe:animate-[roll-out_380ms_cubic-bezier(0.32,0.72,0,1)_900ms_both] motion-reduce:hidden"
            >
              348
            </span>
            <span className="absolute inset-0 motion-safe:animate-[roll-in_380ms_cubic-bezier(0.32,0.72,0,1)_900ms_both]">
              349
            </span>
            {/* Reserves the width. */}
            <span aria-hidden className="invisible">
              349
            </span>
          </div>

          <ol className="mt-6 border-t pt-3 text-sm" aria-label="Reading history">
            <LogRow chapter={349} when="Today" current />
            <LogRow chapter={348} when="Tuesday" />
            <LogRow chapter={347} when="Last Sunday" />
          </ol>
        </div>

        {/* Right page: a note, on ruled paper. */}
        <div className="relative border-t px-6 pt-7 pb-6 sm:border-t-0 sm:px-7 sm:pt-8 sm:pb-7">
          <p className="text-sm text-muted-foreground">Note</p>
          <p className="mt-1 font-display text-[1.15rem] leading-tight font-semibold tracking-[-0.02em]">
            Where I am in BTTH
          </p>
          <p className={`mt-4 text-[0.95rem] leading-7 text-pretty ${RULED}`}>
            Caught up to 349 on the train. New chapters come out on Saturdays, so save the next few
            for the weekend. Ask Mei which translation she reads, hers is further ahead.
          </p>
        </div>
      </div>

      {/* The ribbon, hanging over the top edge of the left page. */}
      <span
        aria-hidden
        className="absolute -top-2 right-6 h-24 w-5 bg-hanko shadow-[0_6px_10px_-6px_rgb(28_26_23/0.5)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-6 motion-safe:duration-500 motion-safe:fill-mode-[both] sm:right-auto sm:left-[calc(50%-0.625rem)]"
      />
    </figure>
  );
}

function LogRow({ chapter, when, current }: { chapter: number; when: string; current?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-1">
      <span className={current ? "text-foreground" : "text-muted-foreground"}>
        Chapter <span className="font-mono tabular-nums">{chapter}</span>
      </span>
      <span className="text-muted-foreground">{current ? "Saved just now" : when}</span>
    </li>
  );
}

/** Google's official four-color "G", as its sign-in branding guidelines require. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
