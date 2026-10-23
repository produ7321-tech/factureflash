import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

declare const process: { env: Record<string, string | undefined> }

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export const Route = createFileRoute('/api/payments/verify')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get('Authorization')
        const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
        const supabaseUrl = process.env.VITE_SUPABASE_URL
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
        const fedapaySecret = process.env.FEDAPAY_SECRET || process.env.FEDAPAY_SECRET_KEY
        if (!token || !supabaseUrl || !supabaseAnonKey) return json({ error: 'Session invalide.' }, 401)
        if (!fedapaySecret) return json({ error: 'Vérification FedaPay indisponible.' }, 503)

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ error: 'Requête invalide.' }, 400)
        }
        if (!body || typeof body !== 'object') return json({ error: 'Requête invalide.' }, 400)
        const input = body as Record<string, unknown>
        const transactionId = String(input.transactionId ?? '')
        const kind = input.kind === 'invoice' ? 'invoice' : 'subscription'
        const invoiceId = String(input.invoiceId ?? '')
        if (!/^\d{1,20}$/.test(transactionId)) return json({ error: 'Référence de transaction invalide.' }, 400)

        const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
        const { data: { user }, error: authError } = await authClient.auth.getUser(token)
        if (authError || !user?.email) return json({ error: 'Session invalide.' }, 401)

        const { postgresStorage } = await import('@/server/postgres')
        let expectedAmount = Number(process.env.VITE_PRO_PRICE) || 1000
        if (!Number.isSafeInteger(expectedAmount) || expectedAmount !== 1000) expectedAmount = 1000
        if (kind === 'invoice') {
          if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(invoiceId)) {
            return json({ error: 'Référence de facture invalide.' }, 400)
          }
          const invoices = await postgresStorage.listRecords('invoices', user.id)
          const invoice = invoices.find(row => row.id === invoiceId)
          if (!invoice) return json({ error: 'Facture introuvable pour ce compte.' }, 404)
          expectedAmount = Number(invoice.total)
          if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 1 || expectedAmount >= 10_000_000) {
            return json({ error: 'Montant de facture invalide.' }, 400)
          }
          if (invoice.status === 'paid') return json({ active: true, paid: true })
        }

        const apiBase = process.env.FEDAPAY_API_URL ?? 'https://sandbox-api.fedapay.com/v1'
        let providerResponse: Response
        try {
          providerResponse = await fetch(`${apiBase}/transactions/${encodeURIComponent(transactionId)}`, {
            headers: { Authorization: `Bearer ${fedapaySecret}`, Accept: 'application/json' },
          })
        } catch {
          return json({ error: 'FedaPay est momentanément inaccessible.' }, 502)
        }
        if (!providerResponse.ok) return json({ error: 'Le prestataire n’a pas confirmé la transaction.' }, 402)

        const providerBody = await providerResponse.json() as Record<string, any>
        const transaction = providerBody.v1?.transaction ?? providerBody.transaction ?? providerBody
        const amount = Number(transaction.amount)
        const status = String(transaction.status ?? '').toLowerCase()
        const customerEmail = String(transaction.customer?.email ?? '').trim().toLowerCase()
        if (amount !== expectedAmount || !['approved', 'transferred'].includes(status) || customerEmail !== user.email.trim().toLowerCase()) {
          return json({ error: 'Le paiement n’a pas pu être vérifié.' }, 402)
        }

        if (kind === 'invoice') {
          const invoices = await postgresStorage.listRecords('invoices', user.id)
          const invoice = invoices.find(row => row.id === invoiceId)
          if (!invoice) return json({ error: 'Facture introuvable pour ce compte.' }, 404)
          await postgresStorage.updateRecord('invoices', user.id, invoiceId, { status: 'paid', fedapayTransactionId: transactionId })
          return json({ active: true, paid: true })
        }

        await postgresStorage.activateSubscription(user.id, transactionId)
        return json({ active: true, plan: 'pro' })
      },
    },
  },
})
