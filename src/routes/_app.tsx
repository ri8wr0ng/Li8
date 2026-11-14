import { useAuthToken } from '@convex-dev/auth/react'
import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { AppShell } from '#/components/app-shell'
import { LogoMark, Splash } from '#/components/brand'
import { CommandPaletteProvider } from '#/components/command-palette'
import { useCacheReady, useHasCache, useOnline } from '#/lib/offline'

export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const token = useAuthToken()
  const cacheReady = useCacheReady()
  const hasCache = useHasCache()
  const online = useOnline()

  // A stored session plus a saved copy is enough to open the app: lists and
  // search render straight away, and offline they stay that way (read-only)
  // until Convex can confirm the session.
  const showSaved = isLoading && token !== null && hasCache
  if (!isAuthenticated && !showSaved) {
    if (isLoading && cacheReady && token !== null && !online) return <OfflineFirstRun />
    if (isLoading || !cacheReady) return <Splash />
    return <Navigate to="/login" />
  }
  return (
    <CommandPaletteProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </CommandPaletteProvider>
  )
}

function OfflineFirstRun() {
  return (
    <main className="pt-safe pb-safe grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-xs">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">You're offline</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Inkmark saves a copy of your notes and library once it has synced. Connect once and it'll open without a
          network after that.
        </p>
      </div>
    </main>
  )
}
