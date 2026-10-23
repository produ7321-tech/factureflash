import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

declare const process: { env: Record<string, string | undefined> }

async function authenticatedUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !key) return null
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error } = await client.auth.getUser(token)
  return error ? null : user
}

export const Route = createFileRoute('/api/clients')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await authenticatedUser(request)
        if (!user) return Response.json({ error: 'Session invalide.' }, { status: 401 })
        const userId = new URL(request.url).searchParams.get('user_id')
        if (!userId) return Response.json({ error: 'user_id is required' }, { status: 400 })
        if (user.id !== userId) return Response.json({ error: 'Accès non autorisé.' }, { status: 403 })
        try {
          const { postgresStorage } = await import('@/server/postgres')
          const clients = await postgresStorage.listClients(userId)
          return Response.json({ clients })
        } catch {
          return Response.json({ error: 'Unable to read clients.' }, { status: 500 })
        }
      },
      POST: async ({ request }) => {
        const user = await authenticatedUser(request)
        if (!user) return Response.json({ error: 'Session invalide.' }, { status: 401 })
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
        }
        if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid client body.' }, { status: 400 })
        const input = body as Record<string, unknown>
        if (typeof input.user_id !== 'string' || !input.user_id.trim() || typeof input.nom !== 'string' || input.nom.trim().length < 2) {
          return Response.json({ error: 'user_id and a client name of at least 2 characters are required.' }, { status: 400 })
        }
        if (user.id !== input.user_id.trim()) return Response.json({ error: 'Accès non autorisé.' }, { status: 403 })
        try {
          const { postgresStorage } = await import('@/server/postgres')
          const client = await postgresStorage.createClient({
            user_id: input.user_id.trim(),
            nom: input.nom.trim(),
            tel: typeof input.tel === 'string' ? input.tel.trim() : null,
            email: typeof input.email === 'string' ? input.email.trim() : null,
          })
          return Response.json({ client }, { status: 201 })
        } catch {
          return Response.json({ error: 'Unable to create client.' }, { status: 500 })
        }
      },
    },
  },
})
