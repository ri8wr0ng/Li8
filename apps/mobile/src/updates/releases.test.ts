import { describe, expect, it } from "vite-plus/test";
import {
  channelOfVersion,
  latestBuild,
  parseReleases,
  updateStatus,
  type GitHubRelease,
} from "./releases";

function release(tag: string, overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  const version = tag.replace("mobile-v", "");
  return {
    tag_name: tag,
    draft: false,
    prerelease: version.includes("-"),
    published_at: "2026-11-18T00:00:00Z",
    html_url: `https://github.com/o/r/releases/tag/${tag}`,
    body: null,
    assets: [
      { name: "SHA256SUMS", browser_download_url: "https://x/SHA256SUMS", size: 100 },
      { name: `inkmark-${version}.apk`, browser_download_url: `https://x/${version}.apk`, size: 5 },
    ],
    ...overrides,
  };
}

describe("parseReleases", () => {
  it("reads versionCode from the notes marker, or a nightly's run number", () => {
    const builds = parseReleases([
      release("mobile-v0.1.0", { body: "notes\n<!-- inkmark:versionCode=12 -->" }),
      release("mobile-v0.1.0-nightly.20261118.9"),
      release("mobile-v0.0.1"),
    ]);
    expect(builds.map((b) => b.versionCode)).toEqual([12, 9, null]);
    expect(builds[0]?.apkUrl).toBe("https://x/0.1.0.apk");
  });

  it("skips drafts, other tags and releases without an APK", () => {
    const builds = parseReleases([
      release("mobile-v0.2.0", { draft: true }),
      release("web-v1.0.0"),
      release("mobile-v0.1.0", { assets: [] }),
    ]);
    expect(builds).toEqual([]);
  });
});

describe("latestBuild", () => {
  const builds = parseReleases([
    release("mobile-v0.1.0", { body: "inkmark:versionCode=10" }),
    release("mobile-v0.1.0-nightly.20261118.14"),
    release("mobile-v0.1.0-nightly.20261117.8"),
  ]);

  it("ignores nightlies on the stable channel", () => {
    expect(latestBuild(builds, "stable")?.tag).toBe("mobile-v0.1.0");
  });

  it("takes the highest versionCode on nightly, stable included", () => {
    expect(latestBuild(builds, "nightly")?.versionCode).toBe(14);
    const stableNewest = parseReleases([
      release("mobile-v0.2.0", { body: "inkmark:versionCode=20" }),
      release("mobile-v0.2.0-nightly.20261118.19"),
    ]);
    expect(latestBuild(stableNewest, "nightly")?.tag).toBe("mobile-v0.2.0");
  });

  it("returns null when the channel is empty", () => {
    expect(
      latestBuild(
        builds.filter((b) => b.prerelease),
        "stable",
      ),
    ).toBeNull();
  });
});

describe("updateStatus", () => {
  const [build] = parseReleases([release("mobile-v0.1.0", { body: "inkmark:versionCode=10" })]);

  it("compares versionCodes when both are known", () => {
    expect(updateStatus({ version: "x", versionCode: 9 }, build).kind).toBe("available");
    expect(updateStatus({ version: "x", versionCode: 10 }, build).kind).toBe("current");
    expect(updateStatus({ version: "x", versionCode: 11 }, build).kind).toBe("ahead");
  });

  it("falls back to the version name", () => {
    expect(updateStatus({ version: "0.1.0", versionCode: null }, build).kind).toBe("current");
    expect(updateStatus({ version: "0.0.9", versionCode: null }, build).kind).toBe("available");
    expect(updateStatus({ version: "0.0.9", versionCode: 3 }, null).kind).toBe("none");
  });
});

describe("channelOfVersion", () => {
  it("defaults to the channel of the installed build", () => {
    expect(channelOfVersion("0.1.0-nightly.20261118.4")).toBe("nightly");
    expect(channelOfVersion("0.1.0")).toBe("stable");
    expect(channelOfVersion(null)).toBe("stable");
  });
});
