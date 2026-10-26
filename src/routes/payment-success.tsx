import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { verifyFedaPayTransaction } from '@/lib/fedapay'
import { supabase } from '@/lib/supabase'

type PaymentStatus = 'checking' | 'success' | 'pending' | 'failed'

export const Route = createFileRoute('/payment-success')({
  head: () => ({ meta: [{ title: 'Confirmation de paiement · FactureFlash 229' }] }),
  component: PaymentSuccessPage,
})

function PaymentSuccessPage() {
  const [status, setStatus] = useState<PaymentStatus>('checking')
  const [transactionId, setTransactionId] = useState('')

  useEffect(() => {
    let active = true

    void (async () => {
      const params = new URLSearchParams(window.location.search)
      const id = params.get('transaction_id') || params.get('id') || ''
      const kind = params.get('kind') === 'invoice' ? 'invoice' : 'subscription'
      const invoiceId = params.get('invoice_id') || undefined
      setTransactionId(id)

      if (!id) {
        setStatus('pending')
        return
      }
      if (!supabase) {
        setStatus('failed')
        return
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!session?.access_token) throw new Error('Reconnectez-vous pour vérifier le paiement.')
        const result = await verifyFedaPayTransaction({
          accessToken: session.access_token,
          transactionId: id,
          kind,
          invoiceId,
        })
        const verified = kind === 'invoice' ? result.paid === true : result.active === true
        if (!verified) throw new Error('Le paiement attend encore la confirmation de FedaPay.')
        if (active) setStatus('success')
      } catch {
        if (active) setStatus('failed')
      }
    })()

    return () => { active = false }
  }, [])

  const heading = {
    checking: 'Vérification du paiement',
    success: 'Paiement réussi',
    pending: 'Paiement en attente',
    failed: 'Paiement non confirmé',
  }[status]

  const description = {
    checking: 'Nous vérifions la transaction auprès de FedaPay…',
    success: 'Votre paiement a été confirmé de manière sécurisée.',
    pending: 'Aucune référence de transaction n’a été reçue. Consultez votre espace pour vérifier son statut.',
    failed: 'Nous ne pouvons pas confirmer ce paiement. La facture ou l’abonnement reste inchangé.',
  }[status]

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <p className="text-sm font-semibold text-primary">FactureFlash 229</p>
        <h1 className="mt-4 text-3xl font-bold">{heading}</h1>
        <p role="status" aria-live="polite" className="mt-4 text-muted-foreground">{description}</p>
        {status === 'success' && transactionId && (
          <p className="mt-4 break-all text-sm text-muted-foreground">
            Numéro de transaction : <span className="font-semibold text-foreground">{transactionId}</span>
          </p>
        )}
        {import.meta.env.VITE_FEDAPAY_PUBLIC_KEY?.startsWith('pk_sandbox_') && (
          <p className="mt-5 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Mode Sandbox — numéro de test MTN : 61000000</p>
        )}
        <Link to="/app" className="mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          Retour à l’application
        </Link>
      </section>
    </main>
  )
}
