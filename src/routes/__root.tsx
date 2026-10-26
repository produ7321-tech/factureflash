/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { APP_NAME, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_TITLE, SITE_OG_DESCRIPTION, SITE_TWITTER_DESCRIPTION } from '@/lib/site'
import type { ReactNode } from 'react'
import indexCss from '../index.css?url'

/**
 * Pre-paint theme script. Runs synchronously in <head> BEFORE first paint, so
 * the document renders in the correct theme on the very first frame — no flash.
 * Dark mode is a single `.dark` class on <html>; the token values in index.css
 * flip under it. Persisted to localStorage, falls back to system preference.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

const queryClient = new QueryClient()

/**
 * Root route — owns the HTML document (SSR), global <head> (SEO-ready),
 * and the app-wide providers.
 *
 * NO app chrome (sidebar/top bar) is applied here by default, so every app —
 * landing pages, marketing sites, content, games — renders FULL-BLEED.
 * Building a SaaS / dashboard app? The sidebar shell already ships at
 * `src/routes/app.tsx` (mounted at the real `/app` segment) with pages under
 * `src/routes/app/` — add pages there. Never create a pathless `src/routes/_app.tsx`:
 * it adds no URL segment, so it (or its `index.tsx`) collides with the root index
 * route at "/". Keep this root bare — don't add chrome here.
 *
 * SEO/AEO: <HeadContent /> renders the merged head() output (title, meta,
 * Open Graph, links) on the server, so crawlers and AI bots receive a
 * fully-rendered, indexable document on the first request. Per-page routes
 * override title/description via their own head().
 *
 * SSR: localStorage access is guarded by the storage adapter and only runs in
 * browser actions/effects; route rendering remains safe for Vercel prerendering.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { name: 'theme-color', content: '#0a0a0a' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'keywords', content: SITE_KEYWORDS },
      { title: SITE_TITLE },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_OG_DESCRIPTION },
      { property: 'og:site_name', content: APP_NAME },
      { property: 'og:locale', content: 'fr_FR' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_TWITTER_DESCRIPTION },
    ],
    links: [
      { rel: 'stylesheet', href: indexCss },
      { rel: 'icon', href: '/favicon.png?v=1792438216816' },
      { rel: 'apple-touch-icon', href: '/favicon.png?v=1792438216816' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
})

function NotFoundPage() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Erreur 404</p>
      <h1 className="mt-3 text-4xl font-bold">Cette page est introuvable</h1>
      <p className="mt-3 max-w-md text-muted-foreground">Vérifiez l’adresse ou retournez à l’accueil FactureFlash 229.</p>
      <a href="/landing" className="mt-7 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Retour à l’accueil</a>
    </main>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* MUST be first: sets the theme class before paint so there is no
            flash-of-wrong-theme. Do not move below <HeadContent />. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
        {/* Global structured data for the FactureFlash brand. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                { '@type': 'WebSite', name: 'FactureFlash', url: '/' },
                { '@type': 'Organization', name: 'FactureFlash', url: '/', sameAs: [] },
              ],
            }),
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider delayDuration={0}>
              <Toaster />
              {/*
                Full-bleed by default — NO app chrome. Child routes render directly.
                SaaS / dashboard app? The sidebar shell already exists at
                `src/routes/app.tsx` (the real `/app` segment) — add pages under
                `src/routes/app/`. Landing pages, marketing sites, content, and games
                stay full-bleed (delete `src/routes/app.tsx` + `src/routes/app/`).
              */}
              {children}
            </TooltipProvider>
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
