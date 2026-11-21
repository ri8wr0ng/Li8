import { describe, expect, it } from "vitest";
import { commands, select } from "./select.ts";

describe("PR test selection", () => {
  it("runs everything when an input every test depends on changes", () => {
    for (const file of [
      "bun.lock",
      "bunfig.toml",
      "apps/web/package.json",
      "packages/backend/convex/tsconfig.json",
      "scripts/test-preload.ts",
      ".github/workflows/ci.yml",
    ]) {
      expect(select(["apps/web/src/lib/motion.ts", file], "origin/main").kind).toBe("all");
    }
  });

  it("runs every Convex test when Convex code changes, since convex-test globs it in", () => {
    const selection = select(["packages/backend/convex/series.ts"], "origin/main");
    expect(commands(selection)).toEqual([
      ["bun", "test", "--isolate", "--changed=origin/main"],
      ["bun", "test", "--isolate", "packages/backend/convex"],
    ]);
  });

  it("runs only the reachable tests for an app change", () => {
    const selection = select(["apps/web/src/lib/motion.ts"], "origin/main");
    expect(commands(selection)).toEqual([["bun", "test", "--isolate", "--changed=origin/main"]]);
  });
});
