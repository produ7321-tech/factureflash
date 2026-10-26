import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { BusinessProfilesRow, ClientsRow, DocumentsRow } from '@/lib/db-types'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { storage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import { payInvoice, verifyFedaPayTransaction, type FedaPayResponse } from '@/lib/fedapay'
import { businessProfileSchema, invoiceSchema } from '@/lib/validation'
import { consumeInvoiceCreationSlot } from '@/lib/rate-limit'
import { canCreateInvoice } from '@/lib/quota'
import { InvoiceTemplatePreview, invoiceTemplateOptions, type InvoiceTemplateData, type InvoiceTemplateId } from '@/components/invoice-templates'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Building2, Check, ChevronRight, CircleHelp, ClipboardList, FilePlus2, FileText, LayoutDashboard, MessageCircle, Plus, Settings2, Users, Wallet, X } from 'lucide-react'
import { ClientOnly } from '@tanstack/react-router'
import { DashboardRevenueChart } from '@/components/DashboardRevenueChart'

type LineItem = { description: string; quantity: number; unitPrice: number }
type ClientDraft = { name: string; phone: string; address: string }
type View = 'dashboard' | 'documents' | 'clients' | 'settings'
const numberFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const money = (value: number | string) => `${numberFmt.format(Number(value) || 0)} FCFA`
const today = () => new Date().toISOString().slice(0, 10)
const inputClass = 'h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10'
const labelClass = 'mb-1.5 block text-xs font-semibold text-foreground'
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export const Route = createFileRoute('/app/')({
  head: () => ({
    meta: [
      { title: 'FactureFlash 229 · Devis et factures' },
      { name: 'description', content: 'Créez et partagez vos devis et factures professionnels en FCFA.' },
    ],
  }),
  component: DashboardHome,
})

function DashboardHome() {
  return <FactureApp />
}

async function createDocumentPdf(row: DocumentsRow, profile: BusinessProfilesRow) {
  const template = row.template || row.templateId || 'classic'
  const thermal = template === 'thermal'
  const pdf = new jsPDF({ unit: 'mm', format: thermal ? [80, 240] : 'a4' })
  const [r, g, b] = hexToRgb(template === 'benin' ? '#138a55' : template === 'premium-dark' ? '#c7a25a' : profile.brandColor || '#1749D2')
  const typeLabel = row.type === 'quote' ? 'DEVIS' : 'FACTURE'
  const items = JSON.parse(row.itemsJson || '[]') as LineItem[]
  const pageWidth = thermal ? 80 : 210
  const left = thermal ? 5 : 17
  const right = pageWidth - left
  const scale = thermal ? 0.68 : 1
  if (template === 'premium-dark') {
    pdf.setFillColor(16, 17, 20)
    pdf.rect(0, 0, pageWidth, thermal ? 240 : 297, 'F')
  }
  if (template === 'modern') {
    pdf.setFillColor(r, g, b)
    pdf.rect(0, 0, pageWidth, 8, 'F')
  }
  if (template === 'benin') {
    pdf.setFillColor(235, 204, 74)
    pdf.rect(0, 52 * scale - 2 * scale, pageWidth, 2 * scale, 'F')
    pdf.setFillColor(200, 45, 55)
    pdf.rect(0, 52 * scale - scale, pageWidth, scale, 'F')
  }
  pdf.setFillColor(r, g, b)
  if (template !== 'minimal' && template !== 'elegant') pdf.rect(0, 0, pageWidth, 52 * scale, 'F')
  if (template === 'minimal') pdf.setTextColor(35, 45, 62)
  else if (template === 'elegant') pdf.setTextColor(r, g, b)
  else pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize((template === 'elegant' ? 28 : 23) * scale)
  pdf.text(profile.businessName || 'Mon entreprise', left, (template === 'elegant' ? 30 : 22) * scale, { maxWidth: pageWidth * 0.63 })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9 * scale)
  pdf.text(`${profile.address || ''}${profile.whatsapp ? ` · WhatsApp ${profile.whatsapp}` : ''}`, left, (template === 'elegant' ? 38 : 30) * scale, { maxWidth: pageWidth * 0.72 })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20 * scale)
  pdf.text(typeLabel, right, 19 * scale, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10 * scale)
  pdf.text(row.number, right, 27 * scale, { align: 'right' })
  if (profile.logoUrl) {
    try {
      const response = await fetch(profile.logoUrl)
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const logoSize = template === 'elegant' ? 36 : thermal ? 17 : 25
      pdf.addImage(dataUrl, dataUrl.includes('png') ? 'PNG' : 'JPEG', pageWidth - (thermal ? 22 : logoSize + 20), template === 'elegant' ? 48 : 34 * scale, logoSize, template === 'elegant' ? 28 : 12 * scale, undefined, 'FAST')
    } catch { /* Logo is optional if the hosted image cannot be fetched by the browser. */ }
  }
  if (template === 'premium-dark') pdf.setTextColor(245, 242, 234)
  else pdf.setTextColor(35, 45, 62)
  pdf.setFontSize(10 * scale)
  pdf.setFont('helvetica', 'bold')
  let y = 67 * scale
  pdf.text('FACTURÉ À', left, y)
  pdf.setFont('helvetica', 'normal')
  y += 7 * scale
  pdf.text(row.clientName, left, y)
  if (row.clientPhone) pdf.text(row.clientPhone, left, y + 6 * scale)
  if (row.clientAddress) pdf.text(row.clientAddress, left, y + 12 * scale, { maxWidth: pageWidth * 0.45 })
  pdf.text(`Émis le ${new Date(row.createdAt).toLocaleDateString('fr-FR')}`, right, y, { align: 'right' })
  if (template === 'benin') {
    pdf.setFontSize(8 * scale)
    pdf.text(`RCCM : ${profile.rccm || 'À compléter'}  ·  IFU : ${profile.ifu || 'À compléter'}  ·  Bénin`, left, y + 20 * scale)
  }
  const top = (template === 'benin' ? 110 : 101) * scale
  pdf.setFillColor(241, 244, 249)
  pdf.roundedRect(left, top, pageWidth - left * 2, 10 * scale, 2 * scale, 2 * scale, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5 * scale)
  pdf.text('DÉSIGNATION', left + 4 * scale, top + 6.5 * scale)
  pdf.text('QTÉ', pageWidth * 0.61, top + 6.5 * scale, { align: 'right' })
  pdf.text('PRIX UNIT.', pageWidth * 0.79, top + 6.5 * scale, { align: 'right' })
  pdf.text('TOTAL', right - 4 * scale, top + 6.5 * scale, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  y = top + 18 * scale
  items.forEach(item => {
    pdf.setFontSize(9.5 * scale)
    pdf.text(item.description || 'Prestation', left + 4 * scale, y, { maxWidth: pageWidth * 0.4 })
    pdf.text(String(item.quantity), pageWidth * 0.61, y, { align: 'right' })
    pdf.text(numberFmt.format(item.unitPrice), pageWidth * 0.79, y, { align: 'right' })
    pdf.text(numberFmt.format(item.quantity * item.unitPrice), right - 4 * scale, y, { align: 'right' })
    pdf.setDrawColor(231, 235, 241)
    pdf.line(left, y + 5 * scale, right, y + 5 * scale)
    y += 13 * scale
  })
  y = Math.max(y + 5 * scale, 145 * scale)
  pdf.setFontSize(9 * scale)
  const totalsX = thermal ? left : pageWidth * 0.67
  pdf.text('Total HT', totalsX, y)
  pdf.text(`${numberFmt.format(Number(row.subtotal))} FCFA`, right, y, { align: 'right' })
  y += 7 * scale
  const taxableAmount = Math.max(0, Number(row.subtotal) - Number(row.discountAmount))
  const vatAmount = row.vatEnabled ? Math.round(taxableAmount * 0.18) : 0
  if (row.vatEnabled) {
    pdf.text('TVA (18 %)', totalsX, y)
    pdf.text(`${numberFmt.format(vatAmount)} FCFA`, right, y, { align: 'right' })
    y += 7 * scale
  }
  pdf.text(`Remise (${Number(row.discountPercent)} %)`, totalsX, y)
  pdf.text(`− ${numberFmt.format(Number(row.discountAmount))} FCFA`, right, y, { align: 'right' })
  y += 9 * scale
  pdf.setFillColor(r, g, b)
  pdf.roundedRect(thermal ? left : pageWidth * 0.63, y - 5 * scale, thermal ? pageWidth - left * 2 : 61, 13 * scale, 2 * scale, 2 * scale, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.text('NET À PAYER', thermal ? left + 3 : pageWidth * 0.65, y + 3 * scale)
  pdf.text(`${numberFmt.format(taxableAmount + vatAmount)} FCFA`, right - 3, y + 3 * scale, { align: 'right' })
  y += 15 * scale
  pdf.setTextColor(45, 55, 72)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Avance payée', 140, y)
  pdf.text(`${numberFmt.format(Number(row.advance))} FCFA`, right, y, { align: 'right' })
  y += 7 * scale
  pdf.setFont('helvetica', 'bold')
  pdf.text('Reste à payer', 140, y)
  pdf.text(`${numberFmt.format(Number(row.total))} FCFA`, right, y, { align: 'right' })
  y += 12 * scale
  if (row.notes) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('MODALITÉS DE PAIEMENT', left, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row.notes, left, y + 7 * scale, { maxWidth: pageWidth * 0.62 })
  }
  if (row.type === 'quote') {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.text('Devis valable 7 jours à compter de sa date d’émission.', left, (thermal ? 210 : 245) * scale)
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(110, 120, 135)
  pdf.text('Merci pour votre confiance.', left, (thermal ? 226 : 276) * scale)
  pdf.setFont('helvetica', 'italic')
  pdf.setTextColor(148, 163, 184)
  pdf.text('Créé avec FactureFlash', right, (thermal ? 235 : 286) * scale, { align: 'right' })
  pdf.text('Cachet / Signature', right, (thermal ? 218 : 264) * scale, { align: 'right' })
  pdf.setDrawColor(190, 198, 211)
  pdf.line(pageWidth * 0.75, (thermal ? 221 : 270) * scale, right, (thermal ? 221 : 270) * scale)
  if (profile.whatsapp) {
    const phone = profile.whatsapp.replace(/\D/g, '')
    const qr = await QRCode.toDataURL(`https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour ${profile.businessName}, je vous contacte au sujet du document ${row.number}.`)}`, { width: 120, margin: 1 })
    pdf.addImage(qr, 'PNG', left, (thermal ? 190 : 246) * scale, 24 * scale, 24 * scale)
    pdf.setFontSize(7)
    pdf.text('Scannez pour contacter', left + 27 * scale, (thermal ? 200 : 260) * scale)
    pdf.text('sur WhatsApp', left + 27 * scale, (thermal ? 204 : 264) * scale)
  }
  return pdf
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [0, 2, 4].map(offset => parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number]
}
function FactureApp() {
  const navigate = useNavigate()
  const [user, setUser] = useState<{ id: string; email?: string; displayName?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [profile, setProfile] = useState<BusinessProfilesRow | null>(null)
  const [clients, setClients] = useState<ClientsRow[]>([])
  const [documents, setDocuments] = useState<DocumentsRow[]>([])
  const [view, setView] = useState<View>('dashboard')
  const [profileDraft, setProfileDraft] = useState({ businessName: '', whatsapp: '', address: '', brandColor: '#1749D2', rccm: '', ifu: '' })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [docType, setDocType] = useState<'quote' | 'invoice'>('invoice')
  const [templateId, setTemplateId] = useState<InvoiceTemplateId>('minimal')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [selectedClient, setSelectedClient] = useState('')
  const [newClient, setNewClient] = useState<ClientDraft | null>(null)
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unitPrice: 0 }])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [advance, setAdvance] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [workingId, setWorkingId] = useState('')
  const [isPro, setIsPro] = useState(false)
  const [invoiceCount, setInvoiceCount] = useState(0)
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)

  useEffect(() => {
    const client = supabase
    if (!client) {
      setAuthLoading(false)
      void navigate({ to: '/login', replace: true })
      return
    }
    let active = true
    void client.auth.getSession().then(async ({ data, error }) => {
      if (!active) return
      if (error || !data.session?.user) {
        void navigate({ to: '/login', replace: true })
      } else {
        const sessionUser = data.session.user
        setUser({ id: sessionUser.id, email: sessionUser.email, displayName: sessionUser.user_metadata.full_name })
        const activeSubscription = await storage.db.isPro(sessionUser.id).catch(() => false)
        if (active) setIsPro(activeSubscription)
      }
      setAuthLoading(false)
    }).catch(() => {
      if (active) {
        setAuthLoading(false)
        void navigate({ to: '/login', replace: true })
      }
    })
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user) setUser({ id: session.user.id, email: session.user.email, displayName: session.user.user_metadata.full_name })
      else void navigate({ to: '/login', replace: true })
    })
    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [navigate])

  const reloadData = useCallback(async (userId: string) => {
    setDataLoading(true)
    try {
      const [profiles, clientRows, invoiceRows, quoteRows] = await Promise.all([
        storage.db.business_profiles.list({ where: { userId }, limit: 1 }),
        storage.db.clients.list({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        storage.db.invoices.list({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        storage.db.quotes.list({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      ])
      const savedProfile = profiles[0] || null
      const docRows = [...invoiceRows, ...quoteRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setProfile(savedProfile)
      setClients(clientRows)
      setDocuments(isPro ? docRows : docRows.slice(0, 3))
      if (savedProfile) setProfileDraft({ businessName: savedProfile.businessName, whatsapp: savedProfile.whatsapp, address: savedProfile.address, brandColor: savedProfile.brandColor, rccm: savedProfile.rccm || '', ifu: savedProfile.ifu || '' })
    } catch {
      toast.error('Impossible de charger les données. Vérifiez votre connexion et réessayez.')
    } finally {
      setDataLoading(false)
    }
  }, [isPro])

  useEffect(() => {
    if (user) void reloadData(user.id)
  }, [reloadData, user])

  useEffect(() => {
    if (!user) return
    void canCreateInvoice(user.id).then(quota => {
      setInvoiceCount(quota.count)
      setIsPro(quota.isPro)
    }).catch(() => undefined)
  }, [user])

  async function openDocumentComposer() {
    if (user) {
      try {
        const quota = await canCreateInvoice(user.id)
        setInvoiceCount(quota.count)
        setIsPro(quota.isPro)
        if (!quota.allowed) {
          setQuotaModalOpen(true)
          return
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Impossible de vérifier votre quota.')
        return
      }
    }
    resetComposer()
    setComposerOpen(true)
  }

  const totals = useMemo(() => {
    const now = new Date()
    const currentMonth = documents.filter(doc => {
      const d = new Date(doc.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const paid = documents.filter(doc => doc.status === 'paid')
    const pending = documents.filter(doc => doc.status !== 'paid')
    return {
      monthRevenue: currentMonth.filter(doc => doc.status === 'paid').reduce((sum, doc) => sum + Number(doc.total), 0),
      paidTotal: paid.reduce((sum, doc) => sum + Number(doc.total), 0),
      pendingTotal: pending.reduce((sum, doc) => sum + Number(doc.total), 0),
    }
  }, [documents])

  const chartData = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index), 1)
    const amount = documents.filter(doc => {
      const created = new Date(doc.createdAt)
      return doc.status === 'paid' && created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear()
    }).reduce((sum, doc) => sum + Number(doc.total), 0)
    return { month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), amount }
  }), [documents])

  const filteredDocuments = documents.filter(doc => `${doc.number} ${doc.clientName}`.toLowerCase().includes(search.toLowerCase()))
  const filteredClients = clients.filter(client => `${client.name} ${client.phone}`.toLowerCase().includes(search.toLowerCase()))
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const discountAmount = Math.round(subtotal * (Number(discountPercent) || 0) / 100)
  const netTotal = Math.max(0, subtotal - discountAmount)
  const vatAmount = vatEnabled ? Math.round(netTotal * 0.18) : 0
  const remaining = Math.max(0, netTotal + vatAmount - (Number(advance) || 0))
  const previewData: InvoiceTemplateData = {
    invoiceNumber: `FF-${new Date().getFullYear()}-0001`,
    issueDate: new Date().toLocaleDateString('fr-FR'),
    businessName: profileDraft.businessName,
    businessAddress: profileDraft.address,
    businessPhone: profileDraft.whatsapp,
    logoUrl: profile?.logoUrl,
    brandColor: profileDraft.brandColor,
    clientName: newClient?.name || clients.find(client => client.id === selectedClient)?.name || '',
    clientAddress: newClient?.address || clients.find(client => client.id === selectedClient)?.address || '',
    items: items.filter(item => item.description.trim()),
    subtotal,
    vatEnabled,
    discount: discountAmount,
    total: netTotal,
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const validatedProfile = businessProfileSchema.safeParse(profileDraft)
    if (!validatedProfile.success) {
      toast.error(validatedProfile.error.issues[0]?.message ?? 'Vérifiez les informations de votre entreprise.')
      return
    }
    setSaving(true)
    try {
      let logoUrl = profile?.logoUrl || ''
      if (logoFile) logoUrl = await fileToDataUrl(logoFile)
      const now = new Date().toISOString()
      const localProfile: BusinessProfilesRow = {
        id: profile?.id || crypto.randomUUID(),
        userId: user.id,
        ...validatedProfile.data,
        logoUrl,
        createdAt: profile?.createdAt || now,
        updatedAt: now,
      }
      const saved = await storage.db.business_profiles.upsert(localProfile)
      setProfile(saved)
      setLogoFile(null)
      toast.success('Votre entreprise est enregistrée en toute sécurité.')
      if (!profile) setView('dashboard')
    } catch { toast.error('Enregistrement impossible. Vérifiez votre connexion et réessayez.') }
    finally { setSaving(false) }
  }

  function resetComposer() {
    setDocType('invoice')
    setTemplateId('minimal')
    setVatEnabled(false)
    setSelectedClient('')
    setNewClient(null)
    setItems([{ description: '', quantity: 1, unitPrice: 0 }])
    setDiscountPercent(0)
    setAdvance(0)
    setDueDate('')
    setNotes('')
  }

  async function saveDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    if (docType === 'invoice') {
      try {
        const quota = await canCreateInvoice(user.id)
        setInvoiceCount(quota.count)
        setIsPro(quota.isPro)
        if (!quota.allowed) {
          setComposerOpen(false)
          setQuotaModalOpen(true)
          return
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Impossible de vérifier votre quota.')
        return
      }
    }
    if (!consumeInvoiceCreationSlot()) {
      toast.error('Limite atteinte : vous pouvez créer jusqu’à 5 documents par minute.')
      return
    }
    const client = newClient?.name ? newClient : clients.find(row => row.id === selectedClient)
    if (!client?.name) { toast.error('Choisissez un client ou ajoutez-en un.'); return }
    if (newClient) {
      const clientValidation = invoiceSchema.shape.clientName.safeParse(newClient.name)
      if (!clientValidation.success) {
        toast.error(clientValidation.error.issues[0]?.message ?? 'Le nom du client est invalide.')
        return
      }
    }
    const validation = invoiceSchema.safeParse({
      clientName: client.name,
      clientPhone: client.phone,
      amount: remaining,
      items: items.filter(item => item.description.trim()),
    })
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? 'Vérifiez les informations du document.')
      return
    }
    setSaving(true)
    try {
      let clientId: string | null = 'id' in client ? String(client.id) : null
      if (!clientId && newClient) {
        const createdClient = await storage.db.clients.create({
          userId: user.id,
          ...newClient,
        })
        clientId = createdClient.id
      }
      if (!supabase) throw new Error('La connexion sécurisée n’est pas configurée.')
      const number = await storage.db.nextInvoiceNumber(user.id, docType)
      const payload = {
        userId: user.id, number, type: docType, clientId,
        clientName: client.name, clientPhone: client.phone, clientAddress: client.address,
        itemsJson: JSON.stringify(items.filter(item => item.description.trim())),
        subtotal, discountPercent: Number(discountPercent) || 0, discountAmount, advance: Number(advance) || 0,
        total: remaining, status: 'unpaid', notes, dueDate, template: templateId, templateId, vatEnabled,
      }
      const targetTable = docType === 'quote' ? storage.db.quotes : storage.db.invoices
      await targetTable.create(payload)
      await reloadData(user.id)
      setComposerOpen(false)
      resetComposer()
      setView('documents')
      toast.success(`${docType === 'quote' ? 'Devis' : 'Facture'} enregistré${docType === 'quote' ? '' : 'e'} en toute sécurité.`)
    } catch { toast.error('Impossible d’enregistrer le document. Vérifiez votre connexion et réessayez.') }
    finally { setSaving(false) }
  }

  async function togglePayment(row: DocumentsRow) {
    if (!user) return
    setWorkingId(row.id)
    try {
      const updatedRow = { ...row, status: row.status === 'paid' ? 'unpaid' : 'paid' }
      const targetTable = row.type === 'quote' ? storage.db.quotes : storage.db.invoices
      await targetTable.update(row.id, { status: updatedRow.status }, user.id)
      await reloadData(user.id)
      toast.success(row.status === 'paid' ? 'Document marqué comme impayé.' : 'Paiement confirmé, document marqué payé.')
    } catch { toast.error('Mise à jour impossible. Vérifiez votre connexion et réessayez.') }
    finally { setWorkingId('') }
  }

  async function convertQuote(row: DocumentsRow) {
    if (!user) return
    setWorkingId(row.id)
    try {
      const quota = await canCreateInvoice(user.id)
      setInvoiceCount(quota.count)
      setIsPro(quota.isPro)
      if (!quota.allowed) {
        setQuotaModalOpen(true)
        return
      }
      const invoiceNumber = await storage.db.nextInvoiceNumber(user.id, 'invoice')
      const payload = {
        userId: user.id, number: invoiceNumber,
        type: 'invoice', clientId: row.clientId, clientName: row.clientName, clientPhone: row.clientPhone,
        clientAddress: row.clientAddress, itemsJson: row.itemsJson, subtotal: Number(row.subtotal),
        discountPercent: Number(row.discountPercent), discountAmount: Number(row.discountAmount), advance: Number(row.advance),
        total: Number(row.total), status: 'unpaid', notes: row.notes, dueDate: row.dueDate,
      }
      await storage.db.invoices.create(payload)
      await reloadData(user.id)
      toast.success('Le devis a été converti en facture.')
    } catch { toast.error('Conversion impossible. Vérifiez votre connexion et réessayez.') }
    finally { setWorkingId('') }
  }

  async function downloadPdf(row: DocumentsRow) {
    if (!profile) { toast.error('Complétez le profil de votre entreprise avant de générer un PDF.'); return }
    try { (await createDocumentPdf(row, profile)).save(`${row.number}.pdf`); toast.success('Votre PDF est prêt à être téléchargé.') }
    catch { toast.error('La génération du PDF a échoué. Vérifiez les données du document.') }
  }

  async function payInvoiceForDocument(row: DocumentsRow) {
    if (!user?.email) {
      toast.error('Connectez-vous avec une adresse e-mail pour encaisser cette facture.')
      return
    }
    try {
      await payInvoice({
        amount: Number(row.total),
        description: `Facture ${row.number} · ${row.clientName}`,
        customerName: row.clientName,
        customerPhone: row.clientPhone,
        customerEmail: user.email,
        callbackUrl: `${window.location.origin}/payment-success?kind=invoice&invoice_id=${encodeURIComponent(row.id)}`,
        onComplete: (response: FedaPayResponse) => { void verifyInvoicePayment(row, response) },
        onCancel: () => toast('Paiement annulé. La facture reste impayée.'),
      })
    } catch {
      toast.error('Impossible de démarrer le paiement. Vérifiez le téléphone du client et réessayez.')
    }
  }

  async function verifyInvoicePayment(row: DocumentsRow, response: FedaPayResponse) {
    const transactionId = String(response.transaction?.id ?? response.id ?? '')
    if (!transactionId || (response.reason !== 'CHECKOUT_COMPLETED' && response.status !== 'approved')) {
      toast.error('Le paiement n’est pas confirmé. La facture reste impayée.')
      return
    }
    if (!supabase || !user) {
      toast.error('La connexion sécurisée a expiré. Reconnectez-vous pour vérifier le paiement.')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast.error('Votre session a expiré. Reconnectez-vous pour vérifier le paiement.')
      return
    }
    try {
      const data = await verifyFedaPayTransaction({
        accessToken: session.access_token,
        transactionId,
        kind: 'invoice',
        invoiceId: row.id,
      })
      if (data.paid !== true) throw new Error('Le paiement est en vérification. La facture ne sera marquée payée qu’après confirmation.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Le paiement est en vérification. La facture ne sera marquée payée qu’après confirmation.')
      return
    }
    await reloadData(user.id)
    toast.success('Paiement confirmé par FedaPay. La facture est marquée payée.')
    window.location.assign(`/payment-success?transaction_id=${encodeURIComponent(transactionId)}&kind=invoice&invoice_id=${encodeURIComponent(row.id)}`)
  }

  function shareOnWhatsApp(row: DocumentsRow) {
    const phone = row.clientPhone.replace(/\D/g, '')
    const message = `Bonjour ${row.clientName}, voici le ${row.type === 'quote' ? 'devis' : 'document'} ${row.number} de ${money(row.total)}. Je vous joins le PDF dans cette conversation.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    toast('WhatsApp est ouvert. Téléchargez puis joignez le PDF à la conversation.')
  }

  if (authLoading) return <div className="flex min-h-[70vh] items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>
  if (!user) return null
  if (dataLoading && !profile) return <div className="flex min-h-[70vh] items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>

  if (!profile || view === 'settings') return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12"><button onClick={() => setView('dashboard')} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour au tableau de bord</button><div className="mb-7"><span className="text-xs font-bold uppercase tracking-[.18em] text-primary">Configuration</span><h1 className="mt-2 text-3xl font-bold tracking-tight">{profile ? 'Votre entreprise' : 'Présentez votre entreprise'}</h1><p className="mt-2 text-sm text-muted-foreground">Ces informations apparaîtront sur vos devis, factures et PDF.</p></div><form onSubmit={saveProfile} className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"><div><label className={labelClass}>Nom de votre entreprise *</label><input required className={inputClass} value={profileDraft.businessName} onChange={e => setProfileDraft({ ...profileDraft, businessName: e.target.value })} placeholder="Ex. Atelier Créatif Cotonou" /></div>
  <div className="grid gap-5 sm:grid-cols-2"><div><label className={labelClass}>WhatsApp professionnel *</label><input required className={inputClass} value={profileDraft.whatsapp} onChange={e => setProfileDraft({ ...profileDraft, whatsapp: e.target.value })} placeholder="+229 01 00 00 00 00" /></div><div><label className={labelClass}>RCCM</label><input className={inputClass} value={profileDraft.rccm} onChange={e => setProfileDraft({ ...profileDraft, rccm: e.target.value })} placeholder="RCCM de l’entreprise" /></div><div><label className={labelClass}>IFU</label><input className={inputClass} value={profileDraft.ifu} onChange={e => setProfileDraft({ ...profileDraft, ifu: e.target.value })} placeholder="Identifiant fiscal unique" /></div></div>
  <div><label className={labelClass}>Adresse</label><input className={inputClass} value={profileDraft.address} onChange={e => setProfileDraft({ ...profileDraft, address: e.target.value })} placeholder="Quartier, ville, pays" /></div>
  <div><label className={labelClass}>Logo de votre entreprise</label><label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-border p-4 transition hover:border-primary/50 hover:bg-muted/40"><span className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-secondary text-primary">{profile?.logoUrl && !logoFile ? <img src={profile.logoUrl} alt="Logo actuel" className="size-full object-cover" /> : <Building2 className="size-6" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{logoFile?.name || 'Choisir une image'}</span><span className="mt-1 block text-xs text-muted-foreground">PNG ou JPG, votre logo sera ajouté à vos PDF</span></span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => setLogoFile(e.target.files?.[0] || null)} /></label></div>
  <button disabled={saving} className="h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:scale-[1.01] disabled:opacity-60 sm:w-auto">{saving ? 'Enregistrement…' : 'Enregistrer mon entreprise'}</button></form></main>

  return <div className="min-h-full px-4 py-6 sm:px-7 lg:px-10 lg:py-8"><div className="mx-auto max-w-7xl"><header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><span className="size-2 rounded-full bg-accent-foreground" /> Espace professionnel</div><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{view === 'dashboard' ? 'Tableau de bord' : view === 'documents' ? 'Mes documents' : 'Mes clients'}</h1><p className="mt-1 text-sm text-muted-foreground">Bonjour {user.displayName}, suivez votre activité en FCFA. Données synchronisées avec votre compte.</p></div><div className="flex flex-wrap items-center gap-2">{isPro ? <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Pro</span> : <><span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">{Math.min(invoiceCount, 3)}/3 gratuites</span><button onClick={() => void navigate({ to: '/pricing' })} className="h-10 rounded-xl bg-amber-500 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600">Passer Pro · 1 000 F</button></>}<button onClick={() => setView('settings')} className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Paramètres entreprise"><Settings2 className="size-4" /></button><button onClick={() => void openDocumentComposer()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.02] active:scale-[.98]"><Plus className="size-4" /><span className="hidden sm:inline">Créer un document</span><span className="sm:hidden">Créer</span></button></div></header>

  <nav className="mb-7 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5" aria-label="Navigation principale">{([['dashboard', 'Vue d’ensemble', LayoutDashboard], ['documents', 'Documents', ClipboardList], ['clients', 'Clients', Users]] as const).map(([key, label, Icon]) => <button key={key} onClick={() => { setView(key); setSearch('') }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${view === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-4" />{label}</button>)}</nav>

  {view === 'dashboard' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[{ label: 'Chiffre d’affaires ce mois', value: totals.monthRevenue, icon: Wallet, tone: 'bg-secondary text-primary', hint: 'Documents payés ce mois-ci' }, { label: 'En attente', value: totals.pendingTotal, icon: CircleHelp, tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', hint: 'Reste à encaisser' }, { label: 'Total payé', value: totals.paidTotal, icon: Check, tone: 'bg-accent text-accent-foreground', hint: 'Tous les documents réglés' }].map(card => <div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{card.label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{money(card.value)}</p></div><span className={`flex size-10 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="size-5" /></span></div><p className="mt-4 text-xs text-muted-foreground">{card.hint}</p></div>)}</div>
  <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Activité financière</h2><p className="mt-1 text-xs text-muted-foreground">Revenus encaissés sur les 6 derniers mois</p></div><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">FCFA</span></div><ClientOnly fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}><Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}><div className="h-64 w-full"><DashboardRevenueChart data={chartData} formatAmount={value => numberFmt.format(value)} /></div></Suspense></ClientOnly></section>
  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Démarrer rapidement</h2><p className="mt-1 text-xs text-muted-foreground">Les essentiels pour votre activité</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><FilePlus2 className="size-5" /></span></div><div className="mt-5 space-y-3">{[{ title: 'Créer un devis ou une facture', desc: 'Ajoutez des lignes et envoyez un PDF', action: () => { void openDocumentComposer() }, icon: FileText }, { title: 'Consulter mes clients', desc: `${clients.length} client${clients.length > 1 ? 's' : ''} enregistré${clients.length > 1 ? 's' : ''}`, action: () => setView('clients'), icon: Users }].map(item => <button key={item.title} onClick={item.action} className="flex w-full items-center gap-3 rounded-xl border border-border p-3.5 text-left transition hover:border-primary/30 hover:bg-muted/50"><span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground"><item.icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.desc}</span></span><ChevronRight className="size-4 text-muted-foreground" /></button>)}</div></section></div>
  <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Derniers documents</h2><p className="mt-1 text-xs text-muted-foreground">Vos devis et factures les plus récents</p></div><button onClick={() => setView('documents')} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Tout voir <ArrowRight className="size-4" /></button></div><DocumentList rows={documents.slice(0, 5)} onDownload={downloadPdf} onShare={shareOnWhatsApp} onToggle={togglePayment} onConvert={convertQuote} onPay={payInvoiceForDocument} workingId={workingId} emptyLabel="Vos premiers documents apparaîtront ici." /></section></>}

  {view === 'documents' && <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Tous vos documents</h2><p className="mt-1 text-xs text-muted-foreground">{documents.length} document{documents.length > 1 ? 's' : ''} enregistré{documents.length > 1 ? 's' : ''}</p></div><input className={`${inputClass} sm:max-w-xs`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un numéro ou client…" aria-label="Rechercher un document" /></div><DocumentList rows={filteredDocuments} onDownload={downloadPdf} onShare={shareOnWhatsApp} onToggle={togglePayment} onConvert={convertQuote} onPay={payInvoiceForDocument} workingId={workingId} emptyLabel={search ? 'Aucun document ne correspond à votre recherche.' : 'Créez votre premier devis ou votre première facture.'} /></section>}

  {view === 'clients' && <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Votre carnet clients</h2><p className="mt-1 text-xs text-muted-foreground">Le total dépensé correspond aux factures marquées comme payées.</p></div><input className={`${inputClass} sm:max-w-xs`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client…" aria-label="Rechercher un client" /></div>{filteredClients.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredClients.map(client => <article key={client.id} className="rounded-xl border border-border p-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">{client.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{client.name}</h3><p className="truncate text-xs text-muted-foreground">{client.phone || 'Téléphone non renseigné'}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs"><span className="text-muted-foreground">Total dépensé</span><strong>{money(documents.filter(document => document.clientId === client.id && document.status === 'paid').reduce((sum, doc) => sum + Number(doc.total), 0))}</strong></div>{client.address && <p className="mt-2 truncate text-xs text-muted-foreground">{client.address}</p>}</article>)}</div> : <EmptyState icon={Users} label={search ? 'Aucun client trouvé.' : 'Vos clients seront ajoutés quand vous créerez un document.'} />}</section>}
  </div>

  {quotaModalOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="quota-title" className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Offre gratuite utilisée</p><h2 id="quota-title" className="mt-2 text-2xl font-bold">Limite atteinte</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Vous avez créé {invoiceCount} factures gratuites. Passez Pro à 1 000 F CFA/mois pour continuer.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={() => void navigate({ to: '/pricing' })} className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Passer Pro</button><button onClick={() => { setQuotaModalOpen(false); setView('documents') }} className="h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Voir mes factures</button></div><button onClick={() => setQuotaModalOpen(false)} className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground">Fermer</button></section></div>}
  {composerOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="composer-title" className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-border bg-background p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="mb-6 flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-[.16em] text-primary">Nouveau document</span><h2 id="composer-title" className="mt-1 text-2xl font-bold">Créer votre document</h2><p className="mt-1 text-sm text-muted-foreground">Les montants sont calculés automatiquement en FCFA.</p></div><button onClick={() => setComposerOpen(false)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Fermer"><X className="size-5" /></button></div><form onSubmit={saveDocument} className="space-y-5"><div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">{(['invoice', 'quote'] as const).map(type => <button type="button" key={type} onClick={() => setDocType(type)} className={`h-10 rounded-lg text-sm font-semibold transition ${docType === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{type === 'invoice' ? 'Facture' : 'Devis'}</button>)}</div>
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]"><div className="space-y-5"><section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Étape 1</p><h3 className="mt-1 text-sm font-semibold">Choisissez un modèle</h3><div className="mt-3 grid grid-cols-2 gap-3">{invoiceTemplateOptions.filter(option => ['classic', 'modern', 'minimal', 'elegant'].includes(option.id)).map(option => <button type="button" key={option.id} onClick={() => setTemplateId(option.id)} aria-pressed={templateId === option.id} className={`rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${templateId === option.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}><span className={`mb-2 block h-16 rounded-lg ${option.id === 'modern' ? 'border-t-4 border-blue-600 bg-slate-50' : option.id === 'minimal' ? 'bg-white' : option.id === 'elegant' ? 'bg-amber-50' : 'bg-slate-100'}`}><span className={`mx-2 mt-2 block h-2 w-1/2 rounded ${option.id === 'elegant' ? 'h-4 w-4 rounded-full bg-amber-400' : 'bg-slate-300'}`} /><span className="mx-2 mt-2 block h-1 w-3/4 rounded bg-slate-200" /><span className="mx-2 mt-2 block h-1 w-1/2 rounded bg-slate-200" /></span><span className="block text-xs font-bold">{option.name}</span><span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{option.description}</span></button>)}</div></section><label className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-sm"><input type="checkbox" checked={vatEnabled} onChange={event => setVatEnabled(event.target.checked)} className="size-4 accent-primary" />Appliquer la TVA béninoise de 18 %</label></div><section className="min-w-0 rounded-2xl border border-border bg-slate-100 p-3 shadow-inner lg:sticky lg:top-5 lg:max-h-[72vh] lg:overflow-auto"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold">Aperçu en direct</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold">{invoiceTemplateOptions.find(option => option.id === templateId)?.name}</span></div><InvoiceTemplatePreview template={templateId} data={previewData} /></section></div>
  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">{newClient ? <><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Nom du client<input className={`${inputClass} mt-1`} value={newClient.name} onChange={event => setNewClient({ ...newClient, name: event.target.value })} placeholder="Nom" /></label><label className="text-xs font-semibold">Téléphone<input className={`${inputClass} mt-1`} value={newClient.phone} onChange={event => setNewClient({ ...newClient, phone: event.target.value })} placeholder="+229…" /></label><label className="text-xs font-semibold">Adresse<input className={`${inputClass} mt-1`} value={newClient.address} onChange={event => setNewClient({ ...newClient, address: event.target.value })} placeholder="Ville, pays" /></label></div><button type="button" onClick={() => setNewClient(null)} className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted"><X className="size-3.5" /> Annuler</button></> : <><label className="text-xs font-semibold">Rechercher un client<input className={`${inputClass} mt-1`} value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Nom, téléphone…" list="invoice-client-options" /><datalist id="invoice-client-options">{clients.filter(client => `${client.name} ${client.phone}`.toLowerCase().includes(clientSearch.toLowerCase())).map(client => <option key={client.id} value={client.name}>{client.phone}</option>)}</datalist></label><button type="button" onClick={() => { setNewClient({ name: '', phone: '', address: '' }); setSelectedClient(''); setClientSearch('') }} className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted"><Plus className="size-3.5" /> Nouveau client</button><div className="sm:col-span-2">{clients.filter(client => `${client.name} ${client.phone}`.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 5).map(client => <button type="button" key={client.id} onClick={() => { setSelectedClient(client.id); setClientSearch(client.name) }} className={`mr-2 mt-2 rounded-full border px-3 py-1.5 text-xs ${selectedClient === client.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>{client.name}{client.phone ? ` · ${client.phone}` : ''}</button>)}</div></>}</div>
  <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Lignes du document</h3><button type="button" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-4" /> Ajouter une ligne</button></div>{items.map((item, index) => <div key={index} className="grid grid-cols-12 gap-2 rounded-xl border border-border p-3"><div className="col-span-12 sm:col-span-5"><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">DÉSIGNATION</label><input className={inputClass} required={index === 0} placeholder="Ex. Création de logo" value={item.description} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} /></div><div className="col-span-4 sm:col-span-2"><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">QUANTITÉ</label><input type="number" min="1" step="1" className={inputClass} value={item.quantity} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, quantity: Number(e.target.value) } : row))} /></div><div className="col-span-5 sm:col-span-3"><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">PRIX UNIT. FCFA</label><input type="number" min="0" step="1" className={inputClass} value={item.unitPrice || ''} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, unitPrice: Number(e.target.value) } : row))} placeholder="0" /></div><div className="col-span-3 flex items-end justify-end text-xs font-semibold sm:col-span-2">{money(item.quantity * item.unitPrice)}{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="ml-2 text-muted-foreground hover:text-destructive" aria-label="Supprimer la ligne"><X className="size-4" /></button>}</div></div>)}</div>
  <div className="grid gap-4 sm:grid-cols-3"><div><label className={labelClass}>Remise (%)</label><input type="number" min="0" max="100" className={inputClass} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} /></div><div><label className={labelClass}>Avance payée (FCFA)</label><input type="number" min="0" className={inputClass} value={advance || ''} onChange={e => setAdvance(Number(e.target.value))} placeholder="0" /></div><div><label className={labelClass}>Date d’échéance</label><input type="date" min={today()} className={inputClass} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div></div>
  <div><label className={labelClass}>Notes et paiement</label><textarea className="min-h-20 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payable via MTN MoMo / Moov Money au : XX" /></div>
  <div className="rounded-2xl bg-muted/70 p-4"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Total HT</span><strong>{money(subtotal)}</strong></div>
  <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Remise ({Number(discountPercent) || 0} %)</span><strong>− {money(discountAmount)}</strong></div>
  <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold"><span>NET À PAYER</span><span>{money(netTotal)}</span></div>
  <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Reste après avance</span><strong className="text-primary">{money(remaining)}</strong></div></div>
  <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setComposerOpen(false)} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-muted">Annuler</button>
  <button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? 'Enregistrement…' : <><Check className="size-4" /> Enregistrer {docType === 'quote' ? 'le devis' : 'la facture'}</>}</button></div></form></section></div>}
  </div>
}

function DocumentList({ rows, onDownload, onShare, onToggle, onConvert, onPay, workingId, emptyLabel }: { rows: DocumentsRow[]; onDownload: (row: DocumentsRow) => void; onShare: (row: DocumentsRow) => void; onToggle: (row: DocumentsRow) => void; onConvert: (row: DocumentsRow) => void; onPay: (row: DocumentsRow) => void; workingId: string; emptyLabel: string }) {
  if (!rows.length) return <EmptyState icon={FileText} label={emptyLabel} />
  return (
    <div className="divide-y divide-border">
      {rows.map(row => (
        <article key={row.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${row.type === 'quote' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-secondary text-primary'}`}><FileText className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{row.number}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{row.type === 'quote' ? 'Devis' : 'Facture'}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.status === 'paid' ? 'bg-accent text-accent-foreground' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{row.status === 'paid' ? 'Payé' : 'Impayé'}</span></div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{row.clientName} · {new Date(row.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end"><strong className="whitespace-nowrap text-sm">{money(row.total)}</strong><div className="flex flex-wrap items-center gap-1">
            <button onClick={() => onDownload(row)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary" aria-label="Télécharger le PDF" title="Télécharger le PDF"><ArrowDownToLine className="size-4" /></button>
            <button onClick={() => onShare(row)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-accent-foreground" aria-label="Partager sur WhatsApp" title="Partager sur WhatsApp"><MessageCircle className="size-4" /></button>
            {row.type === 'invoice' && row.status !== 'paid' && <button onClick={() => onPay(row)} className="rounded-lg bg-primary px-2.5 py-2 text-[11px] font-semibold text-primary-foreground">Payer par Mobile Money</button>}
            <button disabled={workingId === row.id} onClick={() => onToggle(row)} className="rounded-lg border border-border px-2.5 py-2 text-[11px] font-semibold transition hover:bg-muted disabled:opacity-50">{row.status === 'paid' ? 'Impayé' : 'Marquer payé'}</button>
            {row.type === 'quote' && <button disabled={workingId === row.id} onClick={() => onConvert(row)} className="flex size-9 items-center justify-center rounded-lg text-primary transition hover:bg-secondary disabled:opacity-50" aria-label="Transformer en facture" title="Transformer en facture"><ArrowRight className="size-4" /></button>}
          </div></div>
        </article>
      ))}
    </div>
  )
}
function EmptyState({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-5 py-12 text-center"><span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" /></span><p className="max-w-sm text-sm text-muted-foreground">{label}</p></div>
}
