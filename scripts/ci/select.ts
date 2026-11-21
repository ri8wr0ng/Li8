// Picks the tests a PR's diff can reach. PR feedback only: main and the merge queue always run
// every test, so a selection miss can delay a failure but never let one merge.
//
// bun test --changed follows static and dynamic imports. It can't see two things here, so
// they're listed by hand:
// 1. RERUN_ALL: inputs that change how every test runs, not what one test imports.
// 2. GLOB_LOADED: convex-test loads the Convex functions through import.meta.glob, so a test
//    calling api.series.update never imports series.ts. Any change under the Convex
//    directory runs every test there.
export const RERUN_ALL = [
  "bun.lock",
  "bunfig.toml",
  "package.json",
  "**/package.json",
  "tsconfig.json",
  "**/tsconfig*.json",
  "types/**",
  "scripts/test-preload.ts",
  "scripts/ci/**",
  ".github/**",
];
export const GLOB_LOADED = ["packages/backend/convex/**"];

export type Selection =
  | { kind: "all"; reason: string }
  | { kind: "changed"; base: string; alsoDirs: string[]; reason: string };

const matches = (patterns: string[], file: string) =>
  patterns.some((pattern) => new Bun.Glob(pattern).match(file));

export function select(changed: string[], base: string): Selection {
  const everything = changed.find((file) => matches(RERUN_ALL, file));
  if (everything) return { kind: "all", reason: `${everything} changed, which reruns everything` };
  const backend = changed.filter((file) => matches(GLOB_LOADED, file));
  return {
    kind: "changed",
    base,
    alsoDirs: backend.length > 0 ? ["packages/backend/convex"] : [],
    reason:
      backend.length > 0
        ? `tests reachable from ${changed.length} changed file(s), plus every Convex test (${backend[0]} changed)`
        : `tests reachable from ${changed.length} changed file(s)`,
  };
}

export async function changedFiles(base: string): Promise<string[]> {
  const out = await Bun.$`git diff --name-only ${base}...HEAD`.text();
  return out.split("\n").filter(Boolean);
}

// The test commands for a selection. Exported so the selection test can check them.
export function commands(selection: Selection): string[][] {
  const run = ["bun", "test", "--isolate"];
  if (selection.kind === "all") return [run];
  const cmds = [[...run, `--changed=${selection.base}`]];
  for (const dir of selection.alsoDirs) cmds.push([...run, dir]);
  return cmds;
}
