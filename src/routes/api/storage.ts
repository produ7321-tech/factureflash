import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const storageTables = ['businesses', 'business_profiles', 'clients', 'invoices', 'documents', 'quotes', 'invoice_items'] as const
type StorageTable = typeof storageTables[number]
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

function isStorageTable(value: unknown): value is StorageTable {
  return typeof value === 'string' && storageTables.includes(value as StorageTable)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export const Route = createFileRoute('/api/storage')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await authenticatedUser(request)
        if (!user) return Response.json({ error: 'Session invalide.' }, { status: 401 })
        const url = new URL(request.url)
        const userId = url.searchParams.get('user_id') ?? ''
        if (user.id !== userId) return Response.json({ error: 'Accès non autorisé.' }, { status: 403 })
        if (url.searchParams.get('table') === 'subscription') {
          try {
            const { postgresStorage } = await import('@/server/postgres')
            return Response.json({ active: await postgresStorage.isPro(userId) })
          } catch {
            return Response.json({ error: 'Unable to read subscription.' }, { status: 500 })
          }
        }
        const table = url.searchParams.get('table')
        if (!isStorageTable(table) || !userId) {
          return Response.json({ error: 'A valid table and user_id are required.' }, { status: 400 })
        }
        try {
          const { postgresStorage } = await import('@/server/postgres')
          const records = await postgresStorage.listRecords(table, userId)
          return Response.json({ records })
        } catch {
          return Response.json({ error: 'Unable to read records.' }, { status: 500 })
        }
      },
      POST: async ({ request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
        }
        if (!isRecord(body) || typeof body.userId !== 'string') {
          return Response.json({ error: 'A valid userId is required.' }, { status: 400 })
        }
        const user = await authenticatedUser(request)
        if (!user || user.id !== body.userId) return Response.json({ error: 'Session invalide.' }, { status: 401 })
        try {
          const { postgresStorage } = await import('@/server/postgres')
          if (body.action === 'nextNumber') {
            if (body.documentType !== 'invoice' && body.documentType !== 'quote') {
              return Response.json({ error: 'Invalid document type.' }, { status: 400 })
            }
            const number = await postgresStorage.nextInvoiceNumber(body.userId, body.documentType)
            return Response.json({ number })
          }
          if (!isStorageTable(body.table)) {
            return Response.json({ error: 'Invalid storage table.' }, { status: 400 })
          }
          if (body.action === 'create' || body.action === 'upsert') {
            if (!isRecord(body.data)) return Response.json({ error: 'A record payload is required.' }, { status: 400 })
            if (body.action === 'create' && body.table === 'invoices') {
              const [isPro, count] = await Promise.all([
                postgresStorage.isPro(user.id),
                postgresStorage.countInvoices(user.id),
              ])
              if (!isPro && count >= 3) {
                return Response.json({ error: 'Limite gratuite atteinte. Passez Pro pour créer plus de factures.', count, code: 'FREE_INVOICE_LIMIT' }, { status: 403 })
              }
            }
            const record = body.action === 'upsert' && body.table === 'business_profiles'
              ? await postgresStorage.upsertProfile(body.userId, body.data)
              : await postgresStorage.createRecord(body.table, body.userId, body.data)
            return Response.json({ record }, { status: body.action === 'create' ? 201 : 200 })
          }
          if (body.action === 'update') {
            if (typeof body.id !== 'string' || !isRecord(body.data)) {
              return Response.json({ error: 'A record id and payload are required.' }, { status: 400 })
            }
            const record = await postgresStorage.updateRecord(body.table, body.userId, body.id, body.data)
            return Response.json({ record })
          }
          return Response.json({ error: 'Unsupported storage action.' }, { status: 400 })
        } catch {
          return Response.json({ error: 'Unable to save the record.' }, { status: 500 })
        }
      },
    },
  },
})
