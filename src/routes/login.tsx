import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { emailSchema } from '@/lib/validation'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Connexion · FactureFlash 229' },
      { name: 'description', content: 'Connectez-vous à FactureFlash 229 avec un lien sécurisé envoyé par e-mail.' },
    ],
  }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function signInWithProvider(provider: 'google' | 'github') {
    if (!supabase) {
      toast.error('La connexion Supabase n’est pas configurée.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch {
      toast.error(`Connexion ${provider === 'google' ? 'Google' : 'GitHub'} impossible. Réessayez.`)
      setLoading(false)
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Adresse e-mail invalide.')
      return
    }
    if (!supabase) {
      toast.error('La connexion Supabase n’est pas configurée. Ajoutez les variables d’environnement requises.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      })
      if (error) throw error
      setSent(true)
    } catch {
      toast.error('Impossible d’envoyer le lien de connexion. Réessayez dans quelques instants.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <a href="/landing" className="text-sm font-semibold text-primary">FactureFlash 229</a>
        <h1 className="mt-6 text-3xl font-bold">Connexion sécurisée</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {sent ? 'Consultez votre boîte mail : le lien de connexion est en route.' : 'Recevez un lien à usage unique par e-mail. Aucun mot de passe à retenir.'}
        </p>
        {!sent && <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={loading} onClick={() => void signInWithProvider('google')} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"><span className="font-bold text-base text-blue-600" aria-hidden="true">G</span>Continuer avec Google</button>
          <button type="button" disabled={loading} onClick={() => void signInWithProvider('github')} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"><span aria-hidden="true">●</span>Continuer avec GitHub</button>
        </div>}
        {!sent && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium" htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-primary" placeholder="vous@exemple.com" />
            <button disabled={loading} className="h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
              {loading ? 'Envoi…' : 'M’envoyer un lien sécurisé'}
            </button>
          </form>
        )}
        <button type="button" onClick={() => void navigate({ to: '/landing' })} className="mt-5 text-sm text-muted-foreground hover:text-foreground">Retour à l’accueil</button>
      </section>
    </main>
  )
}
