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

## Repo layout

A [Vite+](https://viteplus.dev) monorepo (pnpm workspaces, tasks run with `vp run`):

| Path               | Package            | What                               |
| ------------------ | ------------------ | ---------------------------------- |
| `apps/web`         | `web`              | The web app / PWA (TanStack Start) |
| `apps/mobile`      | `mobile`           | Native app (Expo)                  |
| `packages/backend` | `@inkmark/backend` | Convex functions, schema and tests |

Run `npx convex …` commands from `packages/backend`. `convex dev` writes `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `packages/backend/.env.local`, and the web app reads its env from there.

## Setup

```bash
pnpm install
pnpm dev:backend        # convex dev: log in, create the project, keep it running
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
pnpm dev                # http://localhost:3000 (keep `pnpm dev:backend` running too)
```

## AI features

Optional, and off until a key is set.

- **Ask**: a chat assistant that works from your own notes and Library. It searches by meaning, so "what did I write about that ending" finds the note without the exact words. It can move a chapter forward ("read btth up to 352"), add a series, and create or append to notes, then answers with links to the notes and series it used.
- **Ask AI panel** (⌘J / Ctrl+J, or the sparkle button on phones): the same assistant beside any page. On a note or series it knows what you have open, so "summarize this", "suggest tags", "tidy this into a list" or "mark this completed" act on that page, and the page updates as it does. Remove the page chip to ask without it.
- **Search by meaning** in ⌘K: alongside the typo-tolerant title matches, notes and series that mean the same thing as what you typed.
- **AI usage** (Ask → Usage, or the panel's menu): cost and tokens per day for the last 7, 30 or 90 days, split by Ask replies, indexing and searches, plus how many chat messages and searches you have left right now. Costs come from OpenRouter; embedding costs it doesn't report are estimated from list prices.
- **Kept current**: a note is re-indexed after you stop typing, a series right after it changes, and anything you already had is indexed in batches the first time the palette loads with AI on. Deleting a note or series removes its index entry.

### AI setup

Get a key from [OpenRouter](https://openrouter.ai/keys) and store it on your Convex deployment:

```bash
npx convex env set OPENROUTER_API_KEY <key>
```

One key covers both models: `anthropic/claude-haiku-5.5` for chat and `openai/text-embedding-3-small` for embeddings (1536 dimensions). Until it is set, the AI parts of the app stay hidden. For now AI is also limited to the accounts listed in `AI_ALLOWED_EMAILS` in `convex/aiModels.ts`; everyone else never sees it.

### AI limits and privacy

- Per user, chat allows a burst of 15 messages and refills one a minute; meaning search allows a burst of 30 and refills about three a minute. Past that, Ask says how long to wait.
- With AI on, the text of your notes and Library entries is sent through OpenRouter to those model providers, to build embeddings and to answer Ask. Remove the key with `npx convex env remove OPENROUTER_API_KEY` to turn AI off.

## Continuous integration

Pull requests run `pnpm format:check` (Vite+ / oxfmt), `pnpm typecheck`, `pnpm test` and `pnpm lint` (Vite+ / oxlint, including type-aware checks). Lint warnings fail CI. Run `pnpm format` to apply formatting or `pnpm lint:fix` for lint fixes locally. Configuration lives in `vite.config.ts`. Generated files and installed agent skills are excluded from these checks.

PRs also receive a size label based on added + deleted lines, excluding lockfiles and generated code: `size/XS` (0–9), `size/S` (10–49), `size/M` (50–249), `size/L` (250–499), `size/XL` (500–999), or `size/XXL` (1,000+). The label updates when commits change; size never fails CI. For PRs exceeding GitHub's 3,000-file API limit, the count includes all files. The label workflow starts working once it is on the default branch.

## Deploy

`pnpm build` produces a static app in `apps/web/dist/client`. Serve it from any static host, with all routes falling back to `_shell.html`. Serve `sw.js` and `_shell.html` with `Cache-Control: no-cache` so updates reach installed apps; everything in `assets/` is hashed and can be cached forever. Deploy the backend with `npx convex deploy` from `packages/backend`.

Set `VITE_SITE_URL` (for example `https://inkmark.app`) at build time so link previews get absolute image URLs and the build writes `sitemap.xml` and a canonical link for the sign-in page. On Vercel it defaults to the project's production domain. `robots.txt` is always written and keeps crawlers out of the signed-in pages. The social card is `public/og-image.png`, rendered from `assets/og-image.html` (the command is in that file).

On Vercel, `vercel.json` selects the static output and configures the route fallback and cache headers. The TanStack Start server preset is disabled because this app uses SPA mode.

### Mobile app releases

`.github/workflows/mobile-release.yml` builds the Android app and attaches the APK to a GitHub Release, which people can download and install from their phone. It runs lint, typecheck and tests first.

- **Every push to `main` that changes the mobile app** (`apps/mobile`, `packages/backend` or the lockfile) publishes a nightly prerelease, `mobile-v<version>-nightly.<YYYYMMDD>.<run>`, where `<version>` is `expo.version` in `apps/mobile/app.json`. Nightlies are never marked latest.
- **Pushing a version tag** such as `mobile-v0.1.0` publishes a stable release marked latest. A tag with a suffix (`mobile-v0.1.0-beta.1`) is a prerelease.
- **Run workflow** (Actions → **Mobile release**) on `main` publishes a nightly at once.

To cut a stable release, bump `expo.version` in `apps/mobile/app.json` (so later nightlies count from it), merge, then tag that commit: `git tag mobile-v0.1.0 && git push origin mobile-v0.1.0`. Each release has the APK, a `SHA256SUMS` file and notes generated from merged pull requests. It's created as a draft and published only once every file is attached.

First, set repository variables `EXPO_PUBLIC_CONVEX_URL` (the production Convex URL) and `EXPO_PUBLIC_SITE_URL` (the deployed web app, which serves the sign-in hand-off page). To sign with your own key, add the secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Otherwise the APK uses the shared debug key. Pick one key and keep it: Android only installs an update over an existing install when both are signed with the same key. iOS isn't built, because iPhones only install apps signed through an Apple Developer account.

## Layout

```
packages/backend/convex/   backend: schema, auth, notes, series (chapter history)
apps/web/src/routes/       /login · / (notes) · /notes/$noteId · /library · /library/$seriesId
apps/web/src/components/   app shell, ⌘K palette, highlight textarea, series card
apps/web/src/lib/          search index, highlighting, chapter-command parser, AniList client, offline cache, theme
apps/web/vite/             build plugin that generates the service worker (sw.js)
apps/mobile/app/           Expo Router screens: sign-in, Notes, Library, Profile
apps/mobile/src/           Convex/auth providers, Google sign-in hand-off, theme
```
