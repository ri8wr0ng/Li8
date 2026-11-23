// Runs when T3 Code creates a worktree for a new thread (the "Setup Worktree" action in t3.json).
//
// Env files are gitignored, so a fresh worktree has none. They are copied, not symlinked:
// symlinks on Windows need Developer Mode or admin rights. A file the worktree already has is
// left alone, so running this again never overwrites a worktree's own edits.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const ENV_FILES = [".env.local", join(".vercel", ".env.production.local")];

const worktree = dirname(import.meta.dir);
const projectRoot = process.env.T3CODE_PROJECT_ROOT;
if (!projectRoot) {
  throw new Error("T3CODE_PROJECT_ROOT is not set. Run this through the t3.json setup action.");
}

for (const file of ENV_FILES) {
  const source = join(projectRoot, file);
  const target = join(worktree, file);
  if (!existsSync(source) || !statSync(source).isFile()) {
    console.warn(`Skipping ${file}: not found in ${projectRoot}.`);
    continue;
  }
  if (existsSync(target)) continue;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`Copied ${file}`);
}

// Installs dependencies; the "prepare" script also installs the git hooks.
const install = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], {
  cwd: worktree,
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(install.exitCode ?? 1);
