import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { emailSchema } from '@/lib/validation'
import { useAuth } from '@/contexts/AuthContext'

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
  const { user, loading: authLoading, error: authError } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!authLoading && user) void navigate({ to: '/app', replace: true })
  }, [authLoading, navigate, user])

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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Connexion ${provider === 'google' ? 'Google' : 'GitHub'} impossible.`)
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
        {authError && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{authError}</p>}
        {!sent && <div className="mt-7 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={loading || authLoading} onClick={() => void signInWithProvider('google')} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:border-primary/40 hover:bg-muted disabled:opacity-60">
              <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.57 17.74 9.5 24 9.5Z" transform="translate(0 4)" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.03 47 31.89 47 24.55Z" /><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" transform="translate(0 0)" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-6.26 0-11.57-4.07-13.47-9.72l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" /></svg>
              Continuer avec Google
            </button>
            <button type="button" disabled={loading || authLoading} onClick={() => void signInWithProvider('github')} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition hover:border-primary/40 hover:bg-muted disabled:opacity-60">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 .1.75 1.98 3.37 1.4.1-.73.4-1.23.72-1.51-2.5-.29-5.13-1.25-5.13-5.58 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.64 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.69.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.34-2.64 5.29-5.15 5.57.4.35.77 1.04.77 2.1v3.13c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" /></svg>
              Continuer avec GitHub
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>ou</span><span className="h-px flex-1 bg-border" /></div>
        </div>}
        {!sent && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium" htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-primary" placeholder="vous@exemple.com" />
            <button disabled={loading || authLoading} className="h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
              {loading ? 'Envoi…' : 'M’envoyer un lien sécurisé'}
            </button>
          </form>
        )}
        <button type="button" onClick={() => void navigate({ to: '/landing' })} className="mt-5 text-sm text-muted-foreground hover:text-foreground">Retour à l’accueil</button>
      </section>
    </main>
  )
}
