type FedaPayResponse = {
  id?: string | number
  transaction?: { id?: string | number }
  reason?: string
  status?: string
}

type CheckoutOptions = {
  public_key: string
  transaction: { amount: number; description: string; callback_url: string }
  customer: {
    firstname: string
    lastname: string
    email: string
    phone_number: { number: string; country: 'bj' }
  }
  onComplete: (response: FedaPayResponse) => void
}

type FedaPayWindow = Window & { FedaPay?: { init: (options: CheckoutOptions) => void } }

let loader: Promise<void> | undefined

async function loadCheckoutScript() {
  if ((window as FedaPayWindow).FedaPay) return
  if (!loader) {
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.fedapay.com/checkout.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        loader = undefined
        reject(new Error('Le service de paiement est momentanément indisponible.'))
      }
      document.head.appendChild(script)
    })
  }
  await loader
}

export type FedaPayInput = {
  amount: number
  description: string
  customerName: string
  customerPhone: string
  customerEmail: string
  onComplete: (response: FedaPayResponse) => void
  onCancel?: (response: FedaPayResponse) => void
  callbackUrl?: string
}

export type FedaPayCheckoutInput = {
  amount: number
  description: string
  clientEmail: string
  clientName: string
  clientPhone: string
  onSuccess: (response: FedaPayResponse) => void
  onCancel?: (response: FedaPayResponse) => void
  callbackUrl?: string
}

export async function openFedaPayCheckout({
  amount,
  description,
  clientEmail,
  clientName,
  clientPhone,
  onSuccess,
  onCancel,
  callbackUrl,
}: FedaPayCheckoutInput) {
  if (typeof window === 'undefined') throw new Error('Le paiement doit être lancé depuis votre navigateur.')
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount >= 10_000_000) {
    throw new Error('Le montant doit être compris entre 1 et 9 999 999 FCFA.')
  }

  const publicKey = import.meta.env.VITE_FEDAPAY_PUBLIC_KEY
  if (!publicKey) throw new Error('Le paiement FedaPay n’est pas configuré.')
  const phone = clientPhone.replace(/[^\d+]/g, '')
  if (!/^(?:\+?229)?\d{8,10}$/.test(phone)) throw new Error('Saisissez un numéro béninois valide.')
  const [firstname = 'Client', ...surname] = clientName.trim().split(/\s+/)
  if (!firstname) throw new Error('Le nom du client est requis.')
  const email = clientEmail.trim().toLowerCase()
  if (!zEmail(email)) throw new Error('Une adresse e-mail valide est requise pour confirmer le paiement.')

  await loadCheckoutScript()
  const fedapay = (window as FedaPayWindow).FedaPay
  if (!fedapay) throw new Error('Le service de paiement n’a pas pu être initialisé.')
  fedapay.init({
    public_key: publicKey,
    transaction: {
      amount,
      description: description.slice(0, 120),
      callback_url: callbackUrl ?? `${window.location.origin}/payment-success`,
    },
    customer: {
      firstname,
      lastname: surname.join(' ') || 'Client',
      email,
      phone_number: { number: phone, country: 'bj' },
    },
    onComplete: response => {
      const completed = response.reason === 'CHECKOUT_COMPLETED' || ['approved', 'transferred'].includes(String(response.status).toLowerCase())
      if (completed) onSuccess(response)
      else onCancel?.(response)
    },
  })
}

export async function payInvoice(input: FedaPayInput) {
  return openFedaPayCheckout({
    amount: input.amount,
    description: input.description,
    clientName: input.customerName,
    clientPhone: input.customerPhone,
    clientEmail: input.customerEmail,
    callbackUrl: input.callbackUrl,
    onSuccess: input.onComplete,
    onCancel: input.onCancel,
  })
}

export async function verifyFedaPayTransaction(input: {
  accessToken: string
  transactionId: string
  kind?: 'subscription' | 'invoice'
  invoiceId?: string
}): Promise<{ active?: boolean; paid?: boolean; plan?: string }> {
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({ transactionId: input.transactionId, kind: input.kind, invoiceId: input.invoiceId }),
  })
  const result = await response.json().catch(() => null) as ({ error?: string } & { active?: boolean; paid?: boolean; plan?: string }) | null
  if (!response.ok) throw new Error(result?.error || 'La vérification du paiement a échoué.')
  return result ?? {}
}

function zEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export type { FedaPayResponse }
