import type { InvoiceTemplateId } from '@/components/invoice-templates'

export type InvoiceTemplate = {
  id: Extract<InvoiceTemplateId, 'classic' | 'modern' | 'minimal' | 'elegant'>
  name: string
  description: string
  accent: string
  layout: 'standard' | 'band' | 'airy' | 'logo-first'
}

export const invoiceTemplates: InvoiceTemplate[] = [
  { id: 'classic', name: 'Classic', description: 'Clair, équilibré et professionnel.', accent: '#1749D2', layout: 'standard' },
  { id: 'modern', name: 'Moderne', description: 'Une bande couleur pour une signature vive.', accent: '#0F766E', layout: 'band' },
  { id: 'minimal', name: 'Minimal', description: 'Très épuré, priorité au contenu.', accent: '#334155', layout: 'airy' },
  { id: 'elegant', name: 'Élégant', description: 'Logo grand format et détails raffinés.', accent: '#A16207', layout: 'logo-first' },
]
