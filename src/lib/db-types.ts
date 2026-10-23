// Auto-generated from your database schema — do not edit by hand.
// Regenerates automatically whenever a table is created or altered.

export type BusinessProfilesRow = {
  id: string
  userId: string
  businessName: string
  whatsapp: string
  address: string
  brandColor: string
  rccm?: string
  ifu?: string
  logoUrl: string
  createdAt: string
  updatedAt: string
}

export type ClientsRow = {
  id: string
  userId: string
  name: string
  phone: string
  address: string
  createdAt: string
}

export type DocumentsRow = {
  id: string
  userId: string
  number: string
  type: string
  clientId: string | null
  clientName: string
  clientPhone: string
  clientAddress: string
  itemsJson: string
  subtotal: number | string
  discountPercent: number | string
  discountAmount: number | string
  advance: number | string
  total: number | string
  status: string
  notes: string
  dueDate: string
  createdAt: string
  templateId?: 'minimal' | 'benin' | 'premium-dark' | 'brand' | 'thermal'
  template?: 'classic' | 'modern' | 'minimal' | 'elegant'
  vatEnabled?: boolean
}
