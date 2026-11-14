<img src="assets/icon.svg" width="64" height="64" alt="">

# Inkmark

Notes, and where you left off. A notes app with a reading tracker for manga, manhwa and manhua. It's an installable web app (PWA) that syncs across devices.

- **Notes** that save as you type, with tags and pinning
- **Search** that tolerates typos and highlights what matched, in the notes list, the ⌘K palette, and inside a note with **Ctrl F / ⌘F**
- **Library** for series, with alternative names, type, status, description, genres, a one-tap **+1 chapter** button, chapter history, and a "Read next chapter" link
- **⌘K command bar**: type `btth 349` to set a chapter, `btth +1` to bump it, or `Battle Through The Heavens 348` to add a new series
- **AniList auto-fill**: start typing in Add series and pick a match to fill in names, description, genres, type and chapter count. Linked series get a "Refresh from AniList" button. No cover art is fetched or stored.
- **Works offline**: the app shell is cached by a service worker, and the last notes and library are kept on the device (IndexedDB), so lists and search open instantly and work read-only with no connection
- **Phone-friendly**: swipe a series card right for +1, install to the home screen, safe areas respected

Stack: TanStack Start (SPA mode) · Convex · Convex Auth v2 (Google) · shadcn/ui · Tailwind v4 · MiniSearch. Brand guide: [docs/BRAND.md](docs/BRAND.md).

## Setup

```bash
pnpm install
npx convex dev          # log in, create the project, keep it running
```

### Google sign-in

1. Get your Convex site URL: `npx convex env get CONVEX_SITE_URL`.
2. In Google Cloud Console, go to **APIs & Services → Credentials → Create OAuth client ID → Web application**.
   - Authorized redirect URI: `<CONVEX_SITE_URL>/oauth/google/callback`
3. Store the credentials on your Convex deployment:

   ```bash
   npx convex env set AUTH_GOOGLE_CLIENT_ID <client id>
   npx convex env set AUTH_GOOGLE_CLIENT_SECRET <client secret>
   ```

4. In production, also allow redirects back to your app: `npx convex env set SITE_URL https://your-app.example.com`.

### Run

```bash
pnpm dev                # http://localhost:3000 (keep `npx convex dev` running too)
```

## Continuous integration

Pull requests run `pnpm format:check` (Prettier) and `pnpm lint` (ESLint for TypeScript and React Hooks). Run `pnpm format` to apply formatting locally. Generated files and installed agent skills are excluded from these checks.

PRs also receive a size label based on added + deleted lines, excluding lockfiles and generated code: `size/XS` (0–9), `size/S` (10–49), `size/M` (50–249), `size/L` (250–499), `size/XL` (500–999), or `size/XXL` (1,000+). The label updates when commits change; size never fails CI. For PRs exceeding GitHub's 3,000-file API limit, the count includes all files. The label workflow starts working once it is on the default branch.

## Deploy

`pnpm build` produces a static app in `dist/client`. Serve it from any static host, with all routes falling back to `_shell.html`. Serve `sw.js` and `_shell.html` with `Cache-Control: no-cache` so updates reach installed apps; everything in `assets/` is hashed and can be cached forever. Deploy the backend with `npx convex deploy`.

On Vercel, `vercel.json` selects the static output and configures the route fallback and cache headers. The TanStack Start server preset is disabled because this app uses SPA mode.

## Layout

```
convex/          backend: schema, auth, notes, series (chapter history)
src/routes/      /login · / (notes) · /notes/$noteId · /library · /library/$seriesId
src/components/  app shell, ⌘K palette, highlight textarea, series card
src/lib/         search index, highlighting, chapter-command parser, AniList client, offline cache, theme
vite/            build plugin that generates the service worker (sw.js)
```
