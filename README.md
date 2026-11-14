<img src="assets/icon.svg" width="64" height="64" alt="">

# Inkmark

Notes, and where you left off. A notes app with a reading tracker for manga, manhwa and manhua. It's an installable web app (PWA) that syncs across devices.

- **Notes** that save as you type, with tags and pinning
- **Search** that tolerates typos and highlights what matched, in the notes list, the ⌘K palette, and inside a note with **Ctrl F / ⌘F**
- **Library** for series, with alternative names, type, status, description, genres, a one-tap **+1 chapter** button, chapter history, and a "Read next chapter" link
- **⌘K command bar**: type `btth 349` to set a chapter, `btth +1` to bump it, or `Battle Through The Heavens 348` to add a new series

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

## Deploy

`pnpm build` produces a static app in `dist/client`. Serve it from any static host, with all routes falling back to `_shell.html`. Deploy the backend with `npx convex deploy`.

## Layout

```
convex/          backend: schema, auth, notes, series (chapter history)
src/routes/      /login · / (notes) · /notes/$noteId · /library · /library/$seriesId
src/components/  app shell, ⌘K palette, highlight textarea, series card
src/lib/         search index, highlighting, chapter-command parser
```
