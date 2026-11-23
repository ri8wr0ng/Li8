import { createFileRoute } from "@tanstack/react-router";
import { Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicDocument } from "#/components/public-document";
import { Skeleton } from "#/components/ui/skeleton";
import {
  RELEASES_REPO,
  RELEASES_URL,
  formatBytes,
  isReleaseList,
  latestBuild,
  parseReleases,
  type Build,
} from "#/lib/releases";
import { publicPageHead } from "#/lib/seo";

export const Route = createFileRoute("/download")({
  head: () => publicPageHead("/download", "Download", "Get li8 for Android."),
  component: DownloadPage,
});

type ReleasesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; stable: Build | null; nightly: Build | null };

function DownloadPage() {
  const [state, setState] = useState<ReleasesState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(RELEASES_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub releases responded ${response.status}`);
        return response.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        if (!isReleaseList(data)) {
          setState({ status: "error" });
          return;
        }
        const builds = parseReleases(data);
        setState({
          status: "ready",
          stable: latestBuild(builds, "stable"),
          nightly: latestBuild(builds, "nightly"),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = state.status === "ready" ? (state.stable ?? state.nightly) : null;
  const nightly = state.status === "ready" ? state.nightly : null;
  const showNightly = nightly !== null && nightly !== shown;

  return (
    <PublicDocument title="Get li8 on your phone">
      <div className="not-prose">
        <p className="text-muted-foreground text-base">
          li8 for Android keeps your library and notes in sync with the web. Install the APK below;
          the app updates itself after that.
        </p>

        <div className="rounded-2xl border bg-card p-5 sm:p-6 mt-8">
          {state.status === "loading" ? (
            <>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-40 mt-2" />
              <Skeleton className="h-11 w-40 mt-5 rounded-xl" />
            </>
          ) : state.status === "error" || shown === null ? (
            <>
              <p className="text-sm text-muted-foreground">Couldn't load the latest build.</p>
              <a
                href={`https://github.com/${RELEASES_REPO}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
              >
                See all releases on GitHub
                <ExternalLink className="size-3.5" />
              </a>
            </>
          ) : (
            <>
              <p className="text-[0.7rem] font-medium tracking-wider uppercase text-muted-foreground">
                Android
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight mt-1">
                li8 {shown.version}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatBytes(shown.apkSize)} · Released{" "}
                {new Date(shown.publishedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href={shown.apkUrl}
                  download
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-hanko px-5 text-sm font-medium text-hanko-foreground shadow-sm transition-transform hover:bg-hanko/90 active:scale-95"
                >
                  <Download className="size-4" />
                  Download APK
                </a>
                <a
                  href={shown.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-secondary px-4 text-sm font-medium hover:bg-accent"
                >
                  Release notes
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </>
          )}
        </div>

        {showNightly && nightly !== null && (
          <p className="mt-3 text-sm text-muted-foreground">
            Want the newest changes first? Get the nightly build{" "}
            <a href={nightly.apkUrl} className="text-foreground underline underline-offset-4">
              {nightly.version}
            </a>
          </p>
        )}

        <h2 className="font-display text-lg font-semibold tracking-[-0.01em] mt-12">
          How to install
        </h2>
        <ol className="mt-3 grid gap-3 text-sm">
          {[
            "Download the APK on your Android phone.",
            "Open it. If Android asks, allow installs from your browser.",
            "Sign in with the same Google account you use on the web.",
          ].map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs tabular-nums">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <h2 className="font-display text-lg font-semibold tracking-[-0.01em] mt-12">iPhone</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          There's no iPhone app yet. Open li8 in Safari, tap Share, then Add to Home Screen to
          install the web app.
        </p>
      </div>
    </PublicDocument>
  );
}
