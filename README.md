<img src="assets/icon.svg" width="64" height="64" alt="">

# li8

li8 is a private notebook and a tracker for manga, manhwa, manhua, novels, anime, and TV. Use the installable web app or get the Android APK from [GitHub Releases](https://github.com/ri8wr0ng/li8/releases). Sign in with Google to sync your notes and progress across devices.

- **Notes** that save as you type, with tags and pinning
- **Search** that tolerates typos and highlights what matched, in the notes list, the ⌘K palette, and inside a note with **Ctrl F / ⌘F**
- **Library** for reading and watching progress, with labels, chapter and episode history, and shortcuts to log the next chapter or episode
- **⌘K command bar**: type `btth 349` to set a chapter, `btth +1` to bump it, or `Battle Through The Heavens 348` to add a new series
- **AniList auto-fill**: start typing in Add series and pick a match to fill in names, description, genres, type and chapter count. Linked series get a "Refresh from AniList" button. No cover art is fetched or stored.
- **Works offline**: the app shell is cached by a service worker, and the last notes and library are kept on the device (IndexedDB), so lists and search open instantly and work read-only with no connection
- **Phone-friendly**: swipe a series card right for +1, install to the home screen, safe areas respected

Stack: TanStack Start (SPA mode) · Convex · Convex Auth v2 (Google) · shadcn/ui · Tailwind v4 · MiniSearch. Brand guide: [docs/BRAND.md](docs/BRAND.md).

## Repo layout

A [bun](https://bun.com) workspace monorepo (the web app builds with Vite):

| Path               | Package            | What                               |
| ------------------ | ------------------ | ---------------------------------- |
| `apps/web`         | `web`              | The web app / PWA (TanStack Start) |
| `apps/mobile`      | `mobile`           | Native app (Expo)                  |
| `packages/backend` | `@inkmark/backend` | Convex functions, schema and tests |

Run `npx convex …` commands from `packages/backend`. `convex dev` writes `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `packages/backend/.env.local`, and the web app reads its env from there.

## Setup

```bash
bun install
bun dev:backend         # convex dev: log in, create the project, keep it running
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
bun dev                 # http://localhost:3000 (keep `bun dev:backend` running too)
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

Pull requests run `bun fmt --check`, `bun lint` (type-aware, warnings fail), `bun check` (TypeScript 7) and `bun test --isolate` (random order). Run `bun fmt` to apply formatting or `bun lint:fix` for lint fixes locally. Lint rules live in `.oxlintrc.json`, formatting in `.oxfmtrc.json`. `bun lint` runs a pinned bun canary through `bunx`, since stable bun has no linter yet. Generated files and installed agent skills are excluded from these checks.

`bun install` installs git hooks with [hk](https://hk.jdx.dev) (pinned, downloaded and checksum-verified by `scripts/prepare-hk.ts`). Pre-commit formats and lints the staged files; pre-push runs the same checks and tests as CI.

PRs also receive a size label based on added + deleted lines, excluding lockfiles and generated code: `size/XS` (0–9), `size/S` (10–49), `size/M` (50–249), `size/L` (250–499), `size/XL` (500–999), or `size/XXL` (1,000+). The label updates when commits change; size never fails CI. For PRs exceeding GitHub's 3,000-file API limit, the count includes all files. The label workflow starts working once it is on the default branch.

## Deploy

Run `bun run build` to produce the static site in `apps/web/dist/client`. Serve `/login`, `/privacy`, `/terms`, and `/support` from their corresponding `.html` files. Serve existing assets directly and use `_shell.html` as the fallback for other app routes. Vercel configures these rules in [`vercel.json`](vercel.json).

Serve `sw.js` and `_shell.html` with `Cache-Control: no-cache` so updates reach installed apps. Files in `assets/` use content hashes and can be cached indefinitely. Deploy the backend with `npx convex deploy` from `packages/backend`.

Set `VITE_SITE_URL` to your public web origin at build time. The build uses it for canonical links, the sitemap, and the social image URL. On Vercel, it defaults to the project's production domain. The social image lives at `apps/web/public/og-image.png`. See [`assets/og-image.html`](assets/og-image.html) for the regeneration command.

### Google OAuth verification

Use the same verified domain for the public URLs in Google Auth Platform. Set the app name to **li8** and use `/login` for the home page, `/privacy` for the privacy policy, and `/terms` for the terms of service. Open each URL while signed out to confirm it's publicly accessible. The landing page also links to `/support` for help and account deletion requests.

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
apps/web/src/routes/       public pages, notes, Library, and account settings
apps/web/src/components/   app shell, ⌘K palette, highlight textarea, series card
apps/web/src/lib/          search index, highlighting, chapter-command parser, AniList client, offline cache, theme
apps/web/vite/             build plugin that generates the service worker (sw.js)
apps/mobile/app/           Expo Router screens: sign-in, Notes, Library, Profile
apps/mobile/src/           Convex/auth providers, Google sign-in hand-off, theme
```
