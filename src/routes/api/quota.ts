import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

declare const process: { env: Record<string, string | undefined> }

export const Route = createFileRoute('/api/quota')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = request.headers.get('Authorization')
        const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
        const userId = new URL(request.url).searchParams.get('user_id') ?? ''
        const supabaseUrl = process.env.VITE_SUPABASE_URL
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY
        if (!token || !supabaseUrl || !anonKey) return Response.json({ error: 'Session invalide.' }, { status: 401 })

        const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
        const { data: { user }, error } = await client.auth.getUser(token)
        if (error || !user || user.id !== userId) return Response.json({ error: 'Session invalide.' }, { status: 401 })

        try {
          const { postgresStorage } = await import('@/server/postgres')
          const [count, isPro] = await Promise.all([
            postgresStorage.countInvoices(user.id),
            postgresStorage.isPro(user.id),
          ])
          return Response.json({ allowed: isPro || count < 3, count, isPro })
        } catch {
          return Response.json({ error: 'Impossible de vérifier le quota.' }, { status: 500 })
        }
      },
    },
  },
})
