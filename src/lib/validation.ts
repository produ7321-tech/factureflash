import { z } from 'zod'

const beninPhone = z.string().trim().transform(value => value.replace(/[\s()-]/g, '')).refine(
  value => /^(?:\+229)?\d{8,10}$/.test(value),
  'Saisissez un numéro béninois valide avec l’indicatif +229.',
)

export const businessProfileSchema = z.object({
  businessName: z.string().trim().min(2, 'Le nom de l’entreprise doit contenir au moins 2 caractères.').max(120),
  whatsapp: beninPhone,
  address: z.string().trim().max(240),
  brandColor: z.string().regex(/^#[\da-fA-F]{6}$/, 'Choisissez une couleur valide.'),
  rccm: z.string().trim().max(80).optional(),
  ifu: z.string().trim().max(80).optional(),
})

export const invoiceSchema = z.object({
  clientName: z.string().trim().min(2, 'Le nom du client est requis.').max(120),
  clientPhone: z.string().trim().max(24),
  amount: z.number().finite().positive('Le montant total doit être supérieur à zéro.'),
  items: z.array(z.object({
    description: z.string().trim().min(1, 'Chaque ligne doit avoir une désignation.').max(250),
    quantity: z.number().finite().positive('La quantité doit être supérieure à zéro.'),
    unitPrice: z.number().finite().nonnegative('Le prix unitaire ne peut pas être négatif.'),
  })).min(1).max(100),
})

export const emailSchema = z.string().trim().email('Saisissez une adresse e-mail valide.').max(254)
export { beninPhone }
