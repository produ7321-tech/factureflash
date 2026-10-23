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

export const Route = createFileRoute('/api/invoices')({
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
          const invoices = await postgresStorage.listInvoices(userId)
          return Response.json({ invoices })
        } catch {
          return Response.json({ error: 'Unable to read invoices.' }, { status: 500 })
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
        if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid invoice body.' }, { status: 400 })
        const input = body as Record<string, unknown>
        const amount = Number(input.amount)
        if (
          typeof input.user_id !== 'string' || !input.user_id.trim() ||
          typeof input.numero !== 'string' || !input.numero.trim() ||
          !Number.isSafeInteger(amount) || amount <= 0 || amount >= 10_000_000
        ) {
          return Response.json({ error: 'A user, invoice number and amount from 1 to 9,999,999 XOF are required.' }, { status: 400 })
        }
        if (user.id !== input.user_id.trim()) return Response.json({ error: 'Accès non autorisé.' }, { status: 403 })
        const clientId = input.client_id == null ? null : String(input.client_id)
        if (clientId !== null && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(clientId)) {
          return Response.json({ error: 'Invalid client_id.' }, { status: 400 })
        }
        const status = input.status === 'envoyee' || input.status === 'payee' ? input.status : 'brouillon'
        try {
          const { postgresStorage } = await import('@/server/postgres')
          const [isPro, count] = await Promise.all([postgresStorage.isPro(user.id), postgresStorage.countInvoices(user.id)])
          if (!isPro && count >= 3) return Response.json({ error: 'Limite gratuite atteinte.', count, code: 'FREE_INVOICE_LIMIT' }, { status: 403 })
          const invoice = await postgresStorage.createInvoice({
            user_id: input.user_id.trim(),
            client_id: clientId,
            numero: input.numero.trim(),
            amount,
            status,
          })
          return Response.json({ invoice }, { status: 201 })
        } catch {
          return Response.json({ error: 'Unable to create invoice.' }, { status: 500 })
        }
      },
    },
  },
})
