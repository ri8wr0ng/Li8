// Loaded by bun test before every test file (see bunfig.toml).
//
// convex-test, @convex-dev/auth/test and @convex-dev/rate-limiter/test find Convex modules with
// Vite's import.meta.glob, which Bun doesn't have. This rewrites each call into the object Vite
// would build: { "./relative/path.ts": () => import("./relative/path.ts") }.
import { plugin } from "bun";
import { dirname, relative, resolve, sep } from "node:path";

const GLOB_CALL = /import\.meta\.glob\(\s*(\[[^\]]*\]|"[^"]*"|'[^']*')\s*\)/g;

function toPatterns(source: string): string[] {
  const json = source.replaceAll("'", '"').replace(/,\s*\]/, "]");
  const value: unknown = JSON.parse(json);
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function expand(file: string, source: string): string {
  const dir = dirname(file);
  const patterns = toPatterns(source);
  const include = patterns.filter((p) => !p.startsWith("!"));
  const exclude = patterns.filter((p) => p.startsWith("!")).map((p) => new Bun.Glob(p.slice(1)));
  const found = new Set<string>();
  for (const pattern of include) {
    // Scan from the pattern's static prefix so "../component/**" works, like Vite.
    const parts = pattern.split("/");
    const firstGlob = parts.findIndex((part) => /[*?{[]/.test(part));
    const base = resolve(dir, parts.slice(0, firstGlob).join("/"));
    const rest = new Bun.Glob(parts.slice(firstGlob).join("/"));
    for (const match of rest.scanSync({ cwd: base, onlyFiles: true })) {
      const absolute = resolve(base, match);
      // Vite skips node_modules below the glob root, not above it.
      if (absolute === file || match.split(/[\\/]/).includes("node_modules")) continue;
      let key = relative(dir, absolute).split(sep).join("/");
      if (!key.startsWith(".")) key = `./${key}`;
      if (exclude.some((glob) => glob.match(key))) continue;
      found.add(key);
    }
  }
  const entries = [...found].toSorted().map((key) => {
    const specifier = JSON.stringify(key);
    return `${specifier}: () => import(${specifier})`;
  });
  return `({${entries.join(", ")}})`;
}

plugin({
  name: "import.meta.glob",
  setup(build) {
    // Only files that can call it: test files and the @convex-dev packages (they ship TS source).
    const filter = /(\.test\.ts|[\\/]@convex-dev[\\/][^\\/]+[\\/]src[\\/].+\.ts)$/;
    build.onLoad({ filter }, async ({ path }) => {
      const text = await Bun.file(path).text();
      const contents = text.includes("import.meta.glob")
        ? text.replaceAll(GLOB_CALL, (_, arg: string) => expand(path, arg))
        : text;
      const loader = /\.[cm]?tsx?$/.test(path) ? (path.endsWith("x") ? "tsx" : "ts") : "js";
      return { contents, loader };
    });
  },
});

// The backend's Convex functions read this at import time; vitest set it in packages/backend.
process.env.CONVEX_CLOUD_URL ??= "https://some-deployment.convex.cloud";
