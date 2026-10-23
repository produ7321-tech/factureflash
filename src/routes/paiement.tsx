import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/storage'

export const Route = createFileRoute('/paiement')({
  head: () => ({ meta: [{ title: 'Paiement · FactureFlash 229' }] }),
  component: PaymentStatusPage,
})

function PaymentStatusPage() {
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'pending' | 'unavailable'>('checking')

  useEffect(() => {
    const client = supabase
    if (!client) {
      setStatus('unavailable')
      return
    }
    let active = true
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        if (active) setStatus('unavailable')
        return
      }
      const isPro = await storage.db.isPro(data.user.id)
      if (active) setStatus(isPro ? 'confirmed' : 'pending')
    }).catch(() => {
      if (active) setStatus('pending')
    })
    return () => { active = false }
  }, [])

  const message = {
    checking: 'Vérification sécurisée du paiement…',
    confirmed: 'Votre paiement est confirmé. Le plan Pro est actif.',
    pending: 'Le paiement est en cours de vérification. Vous recevrez une confirmation après validation par FedaPay.',
    unavailable: 'Connectez-vous pour consulter le statut de votre paiement.',
  }[status]

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <p className="text-sm font-semibold text-primary">FactureFlash 229</p>
        <h1 className="mt-4 text-3xl font-bold">Statut du paiement</h1>
        <p role="status" className="mt-4 text-muted-foreground">{message}</p>
        <Link to={status === 'unavailable' ? '/login' : '/app'} className="mt-7 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          {status === 'unavailable' ? 'Se connecter' : 'Retour à l’application'}
        </Link>
      </section>
    </main>
  )
}