const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {string} */
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

/**
 * bunfig.toml sets `globalStore = true`, so each node_modules/.bun/<pkg> entry is a link into
 * ~/.bun/install/cache/links. Metro only serves files under a watch folder, so add the store
 * entries this repo actually uses (a few hundred folders, not the whole cache).
 */
const bunStoreFolders = () => {
  const fs = require("fs");
  const store = path.join(monorepoRoot, "node_modules", ".bun");
  if (!fs.existsSync(store)) return [];
  const folders = new Set();
  for (const entry of fs.readdirSync(store)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    try {
      const real = fs.realpathSync(path.join(store, entry));
      if (!real.startsWith(monorepoRoot)) folders.add(real);
    } catch {
      // A dangling link: bun install will recreate it.
    }
  }
  return [...folders];
};

// 1. Watch all files in the monorepo, plus the bun store entries it links to.
config.watchFolders = [monorepoRoot, ...bunStoreFolders()];

// 2. Resolve modules in project node_modules first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
