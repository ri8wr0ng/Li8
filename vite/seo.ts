/// <reference types="node" />
import { loadEnv } from "vite-plus";
import type { Plugin } from "vite";

/** Public pages worth listing in the sitemap. Everything else needs a sign-in. */
const PUBLIC_PATHS = ["/login"];

/** Signed-in pages. Crawlers only ever see a redirect to /login there. */
const PRIVATE_PATHS = ["/notes/", "/library", "/ask"];

/**
 * Resolves the site's public origin and emits /robots.txt and /sitemap.xml.
 *
 * The origin comes from `VITE_SITE_URL` (env or .env file), falling back to
 * Vercel's production domain. It's exposed to the app as
 * `import.meta.env.VITE_SITE_URL` for canonical and Open Graph URLs. Without
 * one, robots.txt is still written but the sitemap and absolute URLs are skipped.
 */
export function seo(): Plugin[] {
  let siteUrl = "";
  const define: Plugin = {
    name: "inkmark:seo-site-url",
    config(config, { mode }) {
      const env = loadEnv(mode, config.envDir || process.cwd(), "VITE_");
      const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      siteUrl = (env.VITE_SITE_URL || (vercel ? `https://${vercel}` : "")).replace(/\/+$/, "");
      return { define: { "import.meta.env.VITE_SITE_URL": JSON.stringify(siteUrl) } };
    },
  };
  const files: Plugin = {
    name: "inkmark:seo-files",
    apply: "build",
    applyToEnvironment: (env) => env.name === "client",
    generateBundle() {
      const robots = [
        "User-agent: *",
        "Allow: /",
        ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
        ...(siteUrl ? ["", `Sitemap: ${siteUrl}/sitemap.xml`] : []),
        "",
      ].join("\n");
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });

      if (!siteUrl) return;
      const urls = PUBLIC_PATHS.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`);
      const sitemap = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        ...urls,
        `</urlset>`,
        "",
      ].join("\n");
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
    },
  };
  return [define, files];
}
