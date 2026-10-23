import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { payInvoice, verifyFedaPayTransaction, type FedaPayResponse } from '@/lib/fedapay'
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/storage'
import { APP_NAME, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_OG_DESCRIPTION, SITE_TITLE } from '@/lib/site'

const pricingTiers = [
  {
    name: 'Gratuit',
    price: '0€',
    billing: '/ mois',
    description: 'Idéal pour tester la solution et créer jusqu’à 3 factures.',
    features: ['3 factures stockées', '1 devis ou facture en cours', 'PDF standard', 'Filigrane “Créé avec FactureFlash”'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: '1 000 F CFA',
    billing: '/ mois',
    description: 'Pour les freelances et auto-entrepreneurs qui veulent plus de liberté et un PDF premium.',
    features: ['Factures illimitées', 'Devis illimités', 'PDF sans filigrane', 'Suivi professionnel et sans limite'],
    highlight: true,
  },
] as const

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: `${APP_NAME} Pricing | Plan Gratuit et Pro` },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'keywords', content: SITE_KEYWORDS },
      { property: 'og:title', content: `${APP_NAME} Pricing | Plan Gratuit et Pro` },
      { property: 'og:description', content: SITE_OG_DESCRIPTION },
      { property: 'og:type', content: 'website' },
    ],
  }),
})

function PricingPage() {
  const navigate = useNavigate()
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    const client = supabase
    if (!client) return
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setIsPro(await storage.db.isPro(data.user.id))
    }).catch(() => setIsPro(false))
  }, [])

  const handleFedaPay = async () => {
    try {
      if (!supabase) {
        await navigate({ to: '/login' })
        return
      }
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user?.email) {
        await navigate({ to: '/login' })
        return
      }
      const phone = window.prompt('Entrez votre numéro béninois pour le paiement FedaPay :', '+229')
      if (!phone) return
      await payInvoice({
        amount: 1000,
        description: 'FactureFlash Pro Mensuel',
        customerName: authData.user.user_metadata.full_name || authData.user.email,
        customerPhone: phone,
        customerEmail: authData.user.email,
        onComplete: (response) => {
          void verifyFedaPayPayment(response)
        },
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de démarrer le paiement FedaPay.')
    }
  }
  async function verifyFedaPayPayment(response: FedaPayResponse) {
    const transactionId = String(response.transaction?.id ?? response.id ?? '')
    if (!transactionId || (response.reason !== 'CHECKOUT_COMPLETED' && response.status !== 'approved')) {
      toast.error('Paiement non confirmé. Aucun abonnement n’a été activé.')
      return
    }
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast.error('Votre session a expiré. Reconnectez-vous puis réessayez.')
      return
    }
    try {
      const data = await verifyFedaPayTransaction({ accessToken: session.access_token, transactionId, kind: 'subscription' })
      if (data.active !== true) throw new Error('La transaction est en attente de vérification.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'La transaction est en attente de vérification.')
      return
    }
    setIsPro(true)
    toast.success('Paiement confirmé par FedaPay. Votre plan Pro est actif.')
    window.location.assign('/paiement')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Tarifs</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Choisissez votre plan {APP_NAME}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {pricingTiers.map((tier) => {
          const isHighlight = tier.highlight

          return (
            <article
              key={tier.name}
              className={[
                'rounded-3xl border p-8 shadow-sm',
                isHighlight
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
              ].join(' ')}
            >
              <p
                className={[
                  'text-sm font-semibold uppercase tracking-[0.2em]',
                  isHighlight ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500',
                ].join(' ')}
              >
                {tier.name}
              </p>

              <div className="mt-6 flex items-end gap-3">
                <span className={['text-4xl font-bold', isHighlight ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'].join(' ')}>
                  {tier.price}
                </span>
                <span className={isHighlight ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500'}>{tier.billing}</span>
              </div>

              <p className={['mt-4', isHighlight ? 'text-slate-300 dark:text-slate-700' : 'text-slate-600 dark:text-slate-300'].join(' ')}>
                {tier.description}
              </p>

              <ul className={['mt-6 space-y-3 text-sm', isHighlight ? 'text-slate-200 dark:text-slate-700' : 'text-slate-700 dark:text-slate-200'].join(' ')}>
                {tier.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              {!tier.highlight ? (
                !isPro ? (
                  <Link
                    to="/app"
                    className="mt-8 inline-flex w-full justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Continuer en gratuit
                  </Link>
                ) : (
                  <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Plan actif
                  </div>
                )
              ) : (
                <div className="mt-8 grid gap-3">
                  <button
                    type="button"
                    onClick={handleFedaPay}
                    className="inline-flex w-full justify-center rounded-xl border border-slate-700 bg-transparent px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-slate-300 dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    Passer Pro — 1 000 F CFA/mois avec FedaPay
                  </button>
                  <p className="text-center text-xs text-slate-300 dark:text-slate-600">
                    Test Sandbox : numéro béninois 61000000.
                  </p>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </main>
  )
}
