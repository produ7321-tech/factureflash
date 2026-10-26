import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { SharedAppLayout } from '@/layouts/shared-app-layout'
import { APP_NAME, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site'
import { useAuth } from '@/contexts/AuthContext'

/**
 * App shell layout — mounted at the REAL `/app` segment (not a pathless `_app`).
 *
 * Everything under `src/routes/app/` renders inside this sidebar chrome:
 *   src/routes/app/index.tsx     → /app          (the dashboard home)
 *   src/routes/app/settings.tsx  → /app/settings (add pages like this)
 *
 * WHY A NAMED SEGMENT, NOT `_app`: a `_`-prefixed layout is PATHLESS — it adds no
 * URL segment, so `_app/index.tsx` IS the `/` route and collides with the root
 * `src/routes/index.tsx` (and a childless `_app.tsx` collides the same way). The
 * build then fails with "Conflicting configuration paths … '/', '/'". Under `/app`
 * that collision is impossible: `app/index.tsx` can only ever be `/app`.
 *
 * DASHBOARD-ONLY PRODUCT (no landing page)? Keep this shell and make the root
 * redirect to it — `src/routes/index.tsx` → `beforeLoad: () => { throw redirect({ to: '/app' }) }`.
 * Redirect to `/app` (a real path), never to a pathless route.
 *
 * LANDING / MARKETING / CONTENT / GAME? You don't need this shell: delete
 * `src/routes/app.tsx` and the `src/routes/app/` folder. Deleting is always safe.
 *
 * The dashboard uses a browser-local storage adapter; it does not require an
 * account or a third-party SDK.
 */
export const Route = createFileRoute('/app')({
  component: AppLayout,
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
    ],
  }),
})

function AppLayout() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) void navigate({ to: '/login', replace: true })
  }, [loading, navigate, user])

  if (loading || !user) {
    return <main className="flex min-h-dvh items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></main>
  }

  return (
    <SharedAppLayout appName={APP_NAME}>
      <Outlet />
    </SharedAppLayout>
  )
}
