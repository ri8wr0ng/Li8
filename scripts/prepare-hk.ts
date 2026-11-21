// Runs on `bun install` (the "prepare" script): installs the git hooks in hk.pkl.
//
// The hooks are the point: agents and people skip steps written in docs, so a missing hk is
// fetched here, pinned and checksum-verified, instead of skipping the hooks with a message.
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const VERSION = "2.13.0";
// sha256 of each release asset, computed when the version was pinned (hk publishes none).
const ASSETS: Record<string, { file: string; sha256: string }> = {
  "win32-x64": {
    file: "hk-x86_64-pc-windows-msvc.zip",
    sha256: "2908de6281368b8128f1d4d7a03905d3ab0eb86a82641d6055be88806bf9ffac",
  },
  "win32-arm64": {
    file: "hk-aarch64-pc-windows-msvc.zip",
    sha256: "54d34ae2e9ce7307658c69021801a2aad64149614eab60640dab7a63a18e2025",
  },
  "linux-x64": {
    file: "hk-x86_64-unknown-linux-gnu.tar.gz",
    sha256: "8ff0b29c9925d73df9b14af7fc43ace86de03db73eafa3046750fce5c39e1955",
  },
  "linux-arm64": {
    file: "hk-aarch64-unknown-linux-gnu.tar.gz",
    sha256: "490196a4e638991c671f42941d72ade4d00b14750145f34fc64377b49fc070bb",
  },
  "darwin-arm64": {
    file: "hk-aarch64-apple-darwin.tar.gz",
    sha256: "64efc441dc0858a175909fd6253ddd6c540da80e7d1bd2a2ad0ec9c0cdab3d97",
  },
};

const git = (...args: string[]) => Bun.spawnSync(["git", ...args]);

// Clones made before Vite+ was removed still point git at its hooks.
const hooksPath = git("config", "--local", "--get", "core.hooksPath").stdout.toString().trim();
if (hooksPath.replaceAll("\\", "/") === ".vite-hooks/_") {
  git("config", "--local", "--unset-all", "core.hooksPath");
}

// CI runs the same checks as jobs; it never commits or pushes, so it needs no hooks.
if (process.env.CI) process.exit(0);
// Not a git checkout (e.g. a tarball install): nothing to hook into.
if (git("rev-parse", "--git-dir").exitCode !== 0) process.exit(0);

const exe = process.platform === "win32" ? "hk.exe" : "hk";
// One copy per user, outside the repo: every worktree shares the same .git/hooks.
const dir = join(homedir(), ".cache", "hk", VERSION);
const hk = join(dir, exe);

if (!existsSync(hk)) {
  const asset = ASSETS[`${process.platform}-${process.arch}`];
  if (!asset) {
    console.error(
      `No pinned hk ${VERSION} for ${process.platform}-${process.arch}. Install it (mise use -g hk@${VERSION}) and add its sha256 to scripts/prepare-hk.ts.`,
    );
    process.exit(1);
  }
  const url = `https://github.com/jdx/hk/releases/download/v${VERSION}/${asset.file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Downloading ${url} failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (sha256 !== asset.sha256) {
    throw new Error(
      `${asset.file} has sha256 ${sha256}, expected ${asset.sha256}. Not installing.`,
    );
  }
  mkdirSync(dir, { recursive: true });
  const archive = join(dir, asset.file);
  await Bun.write(archive, bytes);
  // Windows' own bsdtar reads zip (a Git Bash GNU tar earlier on PATH can't); elsewhere tar.gz.
  const tar =
    process.platform === "win32"
      ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
      : "tar";
  const untar = Bun.spawnSync([tar, "-xf", asset.file], { cwd: dir });
  rmSync(archive);
  if (untar.exitCode !== 0 || !existsSync(hk)) {
    throw new Error(`Extracting ${asset.file} failed: ${untar.stderr.toString()}`);
  }
  if (process.platform !== "win32") chmodSync(hk, 0o755);
}

const install = Bun.spawnSync([hk, "install"], { stdout: "inherit", stderr: "inherit" });
process.exit(install.exitCode ?? 1);
