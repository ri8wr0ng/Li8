import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, Plus, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AddSeriesDialog } from '#/components/add-series-dialog'
import { EmptyState, PageHeader, SearchField, SectionLabel } from '#/components/page'
import { SeriesCard } from '#/components/series-card'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { useCachedQuery } from '#/lib/offline'
import { useSearch } from '#/lib/search'
import { STATUS_LABEL, STATUS_ORDER } from '#/lib/series'
import { cn } from '#/lib/utils'
import { api } from '../../../convex/_generated/api'
import type { SeriesStatus } from '../../../convex/validators'

type Filter = SeriesStatus | 'all'

export const Route = createFileRoute('/_app/library/')({
  validateSearch: (search: Record<string, unknown>): { status?: Filter } => {
    const s = search.status
    return s === 'all' || STATUS_ORDER.includes(s as SeriesStatus) ? { status: s as Filter } : {}
  },
  component: LibraryPage,
})

function LibraryPage() {
  const series = useCachedQuery(api.series.list, 'series')
  const { search } = useSearch(undefined, series)
  const { status = 'reading' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [query, setQuery] = useState('')

  const q = query.trim()
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, reading: 0, planned: 0, on_hold: 0, completed: 0, dropped: 0 }
    for (const s of series ?? []) {
      c[s.status]++
      c.all++
    }
    return c
  }, [series])

  const hits = useMemo(
    () => search(q, 'series').flatMap((h) => (h.type === 'series' ? [{ series: h.doc, terms: h.terms }] : [])),
    [search, q],
  )
  const shown = (series ?? []).filter((s) => status === 'all' || s.status === status)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        title="Library"
        meta={series ? `${counts.reading} reading · ${counts.all} total` : ' '}
        actions={
          <AddSeriesDialog>
            <Button variant="hanko" className="rounded-xl">
              <Plus /> Add series
            </Button>
          </AddSeriesDialog>
        }
      />

      <SearchField className="mt-6" value={query} onChange={setQuery} placeholder="Search titles and alternative names…" />

      {!q && (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div role="tablist" aria-label="Filter by status" className="flex w-max gap-1.5">
            {(['reading', 'planned', 'on_hold', 'completed', 'dropped', 'all'] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={status === f}
                onClick={() => void navigate({ search: f === 'reading' ? {} : { status: f }, replace: true })}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors',
                  status === f
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'all' ? 'All' : STATUS_LABEL[f]}
                <span className="font-mono text-xs tabular-nums opacity-70">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        {series === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : q ? (
          hits.length ? (
            <>
              <SectionLabel>
                {hits.length} {hits.length === 1 ? 'match' : 'matches'}
              </SectionLabel>
              <Grid>
                {hits.map(({ series: s, terms }) => (
                  <SeriesCard key={s._id} series={s} terms={terms} />
                ))}
              </Grid>
            </>
          ) : (
            <EmptyState icon={<SearchX />} title="Not in your library">
              Nothing matches “{q}”.
              <div className="mt-4">
                <AddSeriesDialog>
                  <Button variant="outline" className="rounded-xl">
                    <Plus /> Add a series
                  </Button>
                </AddSeriesDialog>
              </div>
            </EmptyState>
          )
        ) : series.length === 0 ? (
          <EmptyState icon={<BookOpen />} title="Track what you're reading">
            Add a series once, then bump the chapter with one tap — or press ⌘K and type{' '}
            <span className="font-mono">btth 349</span>.
            <div className="mt-5">
              <AddSeriesDialog>
                <Button variant="hanko" className="rounded-xl">
                  <Plus /> Add your first series
                </Button>
              </AddSeriesDialog>
            </div>
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={<BookOpen />} title={`Nothing in “${status === 'all' ? 'All' : STATUS_LABEL[status]}”`} />
        ) : (
          <Grid>
            {shown.map((s) => (
              <SeriesCard key={s._id} series={s} />
            ))}
          </Grid>
        )}
      </div>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}
