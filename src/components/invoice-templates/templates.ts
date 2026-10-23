export type InvoiceTemplateId = 'classic' | 'modern' | 'minimal' | 'elegant' | 'benin' | 'premium-dark' | 'brand' | 'thermal'

export type InvoiceTemplateData = {
  invoiceNumber: string
  issueDate: string
  businessName: string
  businessAddress: string
  businessPhone: string
  rccm?: string
  ifu?: string
  logoUrl?: string
  brandColor?: string
  clientName: string
  clientAddress?: string
  items: Array<{ description: string; quantity: number; unitPrice: number }>
  subtotal: number
  vatEnabled: boolean
  discount: number
  total: number
  paymentUrl?: string
}

export const invoiceTemplateOptions: Array<{ id: InvoiceTemplateId; name: string; description: string }> = [
  { id: 'classic', name: 'Classic', description: 'Le format professionnel classique.' },
  { id: 'modern', name: 'Moderne', description: 'Une bande couleur et une hiérarchie affirmée.' },
  { id: 'minimal', name: 'Minimal', description: 'Un document très épuré et facile à lire.' },
  { id: 'elegant', name: 'Élégant', description: 'Une identité mise en valeur avec un grand logo.' },
  { id: 'benin', name: 'Pro Bénin', description: 'Touches de couleurs nationales et champs RCCM/IFU.' },
  { id: 'premium-dark', name: 'Premium Dark', description: 'Fond sombre et détails dorés.' },
  { id: 'brand', name: 'Couleur de marque', description: 'Personnalisé selon votre identité.' },
  { id: 'thermal', name: 'Ticket thermique 80 mm', description: 'Mise en page compacte pour impression thermique.' },
]
