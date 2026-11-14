import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { AppShell } from '#/components/app-shell'
import { Splash } from '#/components/brand'
import { CommandPaletteProvider } from '#/components/command-palette'

export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading) return <Splash />
  if (!isAuthenticated) return <Navigate to="/login" />
  return (
    <CommandPaletteProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </CommandPaletteProvider>
  )
}
