import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, ExternalLink, Monitor, Smartphone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AndroidLogo } from "#/components/download-app";
import { PublicDocument } from "#/components/public-document";
import { Badge } from "#/components/ui/badge";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { useReleases } from "#/hooks/use-releases";
import { isPlatform, usePlatform, type Platform } from "#/lib/platform";
import { RELEASES_REPO, formatBytes, latestBuild, type Build } from "#/lib/releases";
import { publicPageHead } from "#/lib/seo";

export const Route = createFileRoute("/download")({
  validateSearch: (search: Record<string, unknown>): { platform?: Platform } =>
    isPlatform(search.platform) ? { platform: search.platform } : {},
  head: () =>
    publicPageHead("/download", "Download", "Get li8 for Android, iPhone, or your computer."),
  component: DownloadPage,
});

const ALL_RELEASES_URL = `https://github.com/${RELEASES_REPO}/releases`;
/** Versions listed before "Show all". */
const VERSIONS_SHOWN = 6;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DownloadPage() {
  const { platform: chosen } = Route.useSearch();
  const detected = usePlatform();
  const navigate = useNavigate({ from: "/download" });
  const platform = chosen ?? detected ?? "android";

  return (
    <PublicDocument title="Download li8">
      <div className="not-prose">
        <p className="text-base text-muted-foreground">
          Your library and notes stay in sync everywhere you sign in. Pick your device.
        </p>

        <Tabs
          value={platform}
          onValueChange={(value) => {
            if (isPlatform(value)) void navigate({ search: { platform: value }, replace: true });
          }}
          className="mt-8 gap-6"
        >
          <TabsList className="h-11 w-full sm:w-fit">
            <TabsTrigger value="android" className="px-4">
              <AndroidLogo /> Android
            </TabsTrigger>
            <TabsTrigger value="iphone" className="px-4">
              <Smartphone /> iPhone
            </TabsTrigger>
            <TabsTrigger value="computer" className="px-4">
              <Monitor /> Computer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="android">
            <AndroidDownloads />
          </TabsContent>
          <TabsContent value="iphone">
            <WebAppCard
              label="iPhone and iPad"
              title="Install li8 from Safari"
              steps={[
                "Open li8 in Safari.",
                "Tap Share, then Add to Home Screen.",
                "Open li8 from your home screen and sign in with Google.",
              ]}
              note="There's no App Store app yet. The web app works offline once it has synced."
            />
          </TabsContent>
          <TabsContent value="computer">
            <WebAppCard
              label="Windows, macOS, and Linux"
              title="Use li8 in your browser"
              steps={[
                "Open li8 in Chrome or Edge.",
                "Click the install icon at the right of the address bar.",
                "li8 opens in its own window, like any other app.",
              ]}
              note="Any modern browser works without installing. Installing adds it to your dock or Start menu."
            />
          </TabsContent>
        </Tabs>
      </div>
    </PublicDocument>
  );
}

function AndroidDownloads() {
  const releases = useReleases();
  const builds = releases.status === "ready" ? releases.builds : [];
  const latest = latestBuild(builds, "stable") ?? latestBuild(builds, "nightly");

  return (
    <>
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        {releases.status === "loading" ? (
          <>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-7 w-40" />
            <Skeleton className="mt-5 h-11 w-40 rounded-xl" />
          </>
        ) : latest === null ? (
          <>
            <p className="text-sm text-muted-foreground">Couldn't load the latest build.</p>
            <GitHubReleasesLink className="mt-3" />
          </>
        ) : (
          <>
            <p className="text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">
              Android · {latest.prerelease ? "Nightly" : "Latest"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              li8 {latest.version}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatBytes(latest.apkSize)} · Released {formatDate(latest.publishedAt)}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={latest.apkUrl}
                download
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-hanko px-5 text-sm font-medium text-hanko-foreground shadow-sm transition-[background-color,scale] duration-150 hover:bg-hanko/90 active:scale-[0.97]"
              >
                <Download className="size-4" />
                Download APK
              </a>
              <a
                href={latest.pageUrl}
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

      <SectionHeading>How to install</SectionHeading>
      <Steps
        steps={[
          "Download the APK on your Android phone.",
          "Open it. If Android asks, allow installs from your browser.",
          "Sign in with the same Google account you use on the web.",
        ]}
      />

      {builds.length > 0 && <VersionList builds={builds} latest={latest} />}
    </>
  );
}

/** Every Android build, newest first: stable releases and nightlies. */
function VersionList({ builds, latest }: { builds: Build[]; latest: Build | null }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = builds.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const shown = showAll ? sorted : sorted.slice(0, VERSIONS_SHOWN);

  return (
    <>
      <SectionHeading>All versions</SectionHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Nightly builds have the newest changes and may have rough edges. The app updates itself on
        the channel you install.
      </p>
      <ul className="mt-4 divide-y rounded-2xl border bg-card">
        {shown.map((build) => (
          <li key={build.tag} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-mono text-sm tabular-nums">{build.version}</span>
                <Badge variant={build.prerelease ? "outline" : "secondary"}>
                  {build.prerelease ? "Nightly" : "Stable"}
                </Badge>
                {build === latest && <Badge>Latest</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(build.publishedAt)} · {formatBytes(build.apkSize)}
              </p>
            </div>
            <a
              href={build.apkUrl}
              download
              aria-label={`Download li8 ${build.version}`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">APK</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {sorted.length > VERSIONS_SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {showAll ? "Show fewer" : `Show all ${sorted.length} versions`}
          </button>
        )}
        <GitHubReleasesLink />
      </div>
    </>
  );
}

function WebAppCard({
  label,
  title,
  steps,
  note,
}: {
  label: string;
  title: string;
  steps: string[];
  note: string;
}) {
  return (
    <>
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <p className="text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
        <Link
          to="/"
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-hanko px-5 text-sm font-medium text-hanko-foreground shadow-sm transition-[background-color,scale] duration-150 hover:bg-hanko/90 active:scale-[0.97]"
        >
          Open li8
        </Link>
      </div>
      <SectionHeading>How to install</SectionHeading>
      <Steps steps={steps} />
    </>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-12 font-display text-lg font-semibold tracking-[-0.01em]">{children}</h2>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-3 grid gap-3 text-sm">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs tabular-nums">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function GitHubReleasesLink({ className }: { className?: string }) {
  return (
    <a
      href={ALL_RELEASES_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 ${className ?? ""}`}
    >
      See all releases on GitHub
      <ExternalLink className="size-3.5" />
    </a>
  );
}
