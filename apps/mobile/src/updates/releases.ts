// Picks the build to offer from the repo's GitHub Releases. Pure: no React Native imports,
// so it runs under the unit tests.
//
// .github/workflows/mobile-release.yml publishes every APK as a release tagged mobile-v<version>:
// nightlies are prereleases (mobile-v0.1.0-nightly.20261118.42), stable tags are not. Android
// only installs an APK over the current one when its versionCode is at least as high, so builds
// are ordered by versionCode (the workflow's run number), not by version name.

export type UpdateChannel = "stable" | "nightly";

export type Build = {
  tag: string;
  version: string;
  /** Android versionCode, or null for a release that doesn't record it. */
  versionCode: number | null;
  prerelease: boolean;
  publishedAt: string;
  pageUrl: string;
  apkUrl: string;
  apkName: string;
  apkSize: number;
};

export type InstalledBuild = {
  version: string | null;
  versionCode: number | null;
};

export type UpdateStatus =
  /** The channel has no release yet. */
  | { kind: "none" }
  /** The installed build is the channel's latest. */
  | { kind: "current"; build: Build }
  /** The channel's latest is newer (or, switching channel, just different) and installable. */
  | { kind: "available"; build: Build }
  /** The installed build is newer than the channel's latest, so Android won't install it. */
  | { kind: "ahead"; build: Build };

/** The subset of GitHub's release JSON that is read here. */
export type GitHubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  body: string | null;
  assets: { name: string; browser_download_url: string; size: number }[];
};

const TAG_PREFIX = "mobile-v";
// Written into the release notes by the workflow: <!-- inkmark:versionCode=42 -->
const VERSION_CODE_MARKER = /inkmark:versionCode=(\d+)/;
// Nightlies end in the run number, which is also their versionCode.
const NIGHTLY_RUN = /-nightly\.\d+\.(\d+)$/;

function versionCodeOf(version: string, body: string | null): number | null {
  const marked = body?.match(VERSION_CODE_MARKER);
  if (marked) return Number(marked[1]);
  const nightly = version.match(NIGHTLY_RUN);
  return nightly ? Number(nightly[1]) : null;
}

/** A light shape check of GitHub's release list response. */
export function isReleaseList(value: unknown): value is GitHubRelease[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "tag_name" in item &&
        typeof item.tag_name === "string" &&
        "assets" in item &&
        Array.isArray(item.assets),
    )
  );
}

export function parseReleases(releases: GitHubRelease[]): Build[] {
  const builds: Build[] = [];
  for (const release of releases) {
    if (release.draft || !release.tag_name.startsWith(TAG_PREFIX)) continue;
    const apk = release.assets.find((asset) => asset.name.endsWith(".apk"));
    if (!apk) continue;
    const version = release.tag_name.slice(TAG_PREFIX.length);
    builds.push({
      tag: release.tag_name,
      version,
      versionCode: versionCodeOf(version, release.body),
      prerelease: release.prerelease,
      publishedAt: release.published_at ?? "",
      pageUrl: release.html_url,
      apkUrl: apk.browser_download_url,
      apkName: apk.name,
      apkSize: apk.size,
    });
  }
  return builds;
}

function isNewer(a: Build, b: Build): boolean {
  if (a.versionCode !== null && b.versionCode !== null && a.versionCode !== b.versionCode) {
    return a.versionCode > b.versionCode;
  }
  return a.publishedAt > b.publishedAt;
}

/**
 * The newest build on a channel. Nightly includes stable releases, so someone on nightly is
 * never left on a build older than the latest stable.
 */
export function latestBuild(builds: Build[], channel: UpdateChannel): Build | null {
  let latest: Build | null = null;
  for (const build of builds) {
    if (channel === "stable" && build.prerelease) continue;
    if (latest === null || isNewer(build, latest)) latest = build;
  }
  return latest;
}

export function updateStatus(installed: InstalledBuild, latest: Build | null): UpdateStatus {
  if (latest === null) return { kind: "none" };
  if (installed.versionCode !== null && latest.versionCode !== null) {
    if (latest.versionCode > installed.versionCode) return { kind: "available", build: latest };
    if (latest.versionCode < installed.versionCode) return { kind: "ahead", build: latest };
    return { kind: "current", build: latest };
  }
  // Without a versionCode on one side, fall back to the version name.
  return latest.version === installed.version
    ? { kind: "current", build: latest }
    : { kind: "available", build: latest };
}

/** The channel a build came from, used as the default before the user picks one. */
export function channelOfVersion(version: string | null): UpdateChannel {
  return version?.includes("-nightly") ? "nightly" : "stable";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
