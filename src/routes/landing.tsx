import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Check, FileText, Users, Wallet } from 'lucide-react'
import { APP_NAME, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_OG_DESCRIPTION, SITE_TITLE } from '@/lib/site'

const featureCards = [
  {
    title: 'Facture',
    text: 'Créez une facture claire, rapide et prête à envoyer à vos clients.',
  },
  {
    title: 'Devis',
    text: 'Envoyez un devis professionnel en quelques minutes avant la validation du projet.',
  },
  {
    title: 'Freelance',
    text: 'Centralisez vos factures, devis et relances sans perdre de temps sur l’administration.',
  },
]

export const Route = createFileRoute('/landing')({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'keywords', content: SITE_KEYWORDS },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_OG_DESCRIPTION },
      { property: 'og:type', content: 'website' },
    ],
  }),
})

function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-16">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-12">
        <p className="mb-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {APP_NAME}
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Factures, devis, clients : tout en un
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Gérez toute votre activité au même endroit : créez des documents professionnels, retrouvez vos clients et suivez les paiements en FCFA.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/app"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            Découvrir mon espace
          </Link>
          <Link
            to="/pricing"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Voir les plans
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-600 dark:text-slate-300">
          <span>✓ Factures et devis</span>
          <span>✓ Carnet clients</span>
          <span>✓ Suivi des paiements</span>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {featureCards.map(({ title, text }) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          { icon: FileText, title: 'Factures illimitées avec Pro', text: 'Préparez des factures soignées et suivez vos règlements sans limite avec le plan Pro à 1 000 F CFA/mois.' },
          { icon: Check, title: 'Devis professionnels', text: 'Présentez vos prestations clairement avant le démarrage de chaque mission.' },
          { icon: Users, title: 'Clients et suivi de paiement', text: 'Centralisez les coordonnées de vos clients et visualisez rapidement les montants réglés ou en attente.' },
        ].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"><span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Icon className="size-5" /></span><h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p></article>)}
      </section>

      <section className="rounded-3xl bg-slate-950 p-8 text-white sm:p-10">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-300">Pensé pour votre quotidien</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Une gestion simple, du devis au paiement.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Un seul espace pour organiser vos clients, créer vos documents et garder une vue claire de votre activité.</p></div><div className="flex gap-3"><div className="rounded-2xl bg-white/10 px-5 py-4"><FileText className="size-5 text-blue-300" /><p className="mt-3 text-sm font-semibold">Documents</p><p className="text-xs text-slate-300">Factures + devis</p></div><div className="rounded-2xl bg-white/10 px-5 py-4"><Wallet className="size-5 text-emerald-300" /><p className="mt-3 text-sm font-semibold">Paiements</p><p className="text-xs text-slate-300">Suivi en FCFA</p></div></div></div>
      </section>

      <section aria-label="Repères de l’offre" className="grid gap-4 text-center sm:grid-cols-3">
        {[['3', 'factures offertes'], ['4', 'modèles de facture'], ['1 000 F', 'Pro par mois']].map(([value, label]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Pourquoi les freelances utilisent {APP_NAME}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Gain de temps</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Tout est prêt en quelques clics : facture, devis, montant, TVA, notes et détails.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Simple à utiliser</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Conçu pour les indépendants, les auto-entrepreneurs et les petites structures.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Offre</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Tout votre suivi professionnel</h2>
          </div>
          <Link
            to="/app"
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            Commencer gratuitement <ArrowRight className="ml-2 inline size-4" />
          </Link>
        </div>
        <div className="mt-6 flex items-end gap-3">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">0€</span>
          <span className="text-slate-500">/ mois</span>
        </div>
      </section>
    </main>
  )
}
