import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/storage'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        if (!supabase) throw new Error('La connexion n’est pas configurée.')
        const { data, error } = await supabase.auth.getSession()
        const user = data.session?.user
        if (error || !user) throw new Error('La session de connexion est invalide.')

        const profiles = await storage.db.business_profiles.list({ where: { userId: user.id }, limit: 1 })
        if (!profiles.length) {
          const now = new Date().toISOString()
          const fullName = String(user.user_metadata.full_name ?? user.user_metadata.name ?? user.email?.split('@')[0] ?? '')
          await storage.db.business_profiles.upsert({
            id: crypto.randomUUID(),
            userId: user.id,
            businessName: fullName,
            whatsapp: '',
            address: '',
            brandColor: '#1749D2',
            logoUrl: String(user.user_metadata.avatar_url ?? user.user_metadata.picture ?? ''),
            createdAt: now,
            updatedAt: now,
          })
        }
        if (active) await navigate({ to: '/app', replace: true })
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : 'Connexion impossible. Réessayez.')
          await navigate({ to: '/login', replace: true })
        }
      }
    })()
    return () => { active = false }
  }, [navigate])

  return <main className="flex min-h-dvh items-center justify-center px-4"><p className="text-sm text-muted-foreground">Finalisation de votre connexion sécurisée…</p></main>
}
