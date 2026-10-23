import { supabase } from '@/lib/supabase'

type InvoiceQuota = { allowed: boolean; count: number; isPro: boolean }

export async function canCreateInvoice(userId: string): Promise<InvoiceQuota> {
  if (!supabase) throw new Error('La session utilisateur est indisponible.')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token || session.user.id !== userId) throw new Error('Connectez-vous pour vérifier votre quota.')

  const response = await fetch(`/api/quota?user_id=${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const result = await response.json().catch(() => null) as (InvoiceQuota & { error?: string }) | null
  if (!response.ok || !result) throw new Error(result?.error || 'Impossible de vérifier votre quota.')
  return { allowed: result.allowed, count: result.count, isPro: result.isPro }
}
