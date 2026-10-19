import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { blink } from '@/blink/client'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import type { BusinessProfilesRow, ClientsRow, DocumentsRow } from '@/lib/db-types'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Building2, Check, ChevronRight, CircleHelp, ClipboardList, FilePlus2, FileText, LayoutDashboard, MessageCircle, Plus, Settings2, Users, Wallet, X } from 'lucide-react'

type LineItem = { description: string; quantity: number; unitPrice: number }
type ClientDraft = { name: string; phone: string; address: string }
type View = 'dashboard' | 'documents' | 'clients' | 'settings'
const numberFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const money = (value: number | string) => `${numberFmt.format(Number(value) || 0)} FCFA`
const today = () => new Date().toISOString().slice(0, 10)
const inputClass = 'h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10'
const labelClass = 'mb-1.5 block text-xs font-semibold text-foreground'
const profileTable = blink.db.table<BusinessProfilesRow>('business_profiles')
const clientsTable = blink.db.table<ClientsRow>('clients')
const documentsTable = blink.db.table<DocumentsRow>('documents')

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
  return <BlinkClientBoundary fallback={<div className="flex min-h-dvh items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>}><FactureApp /></BlinkClientBoundary>
}

async function createDocumentPdf(row: DocumentsRow, profile: BusinessProfilesRow) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const [r, g, b] = hexToRgb(profile.brandColor || '#1749D2')
  const typeLabel = row.type === 'quote' ? 'DEVIS' : 'FACTURE'
  const items = JSON.parse(row.itemsJson || '[]') as LineItem[]
  pdf.setFillColor(r, g, b)
  pdf.rect(0, 0, 210, 52, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(23)
  pdf.text(profile.businessName || 'Mon entreprise', 17, 22, { maxWidth: 135 })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`${profile.address || ''}${profile.whatsapp ? ` · WhatsApp ${profile.whatsapp}` : ''}`, 17, 30, { maxWidth: 150 })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(typeLabel, 193, 19, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(row.number, 193, 27, { align: 'right' })
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
      pdf.addImage(dataUrl, dataUrl.includes('png') ? 'PNG' : 'JPEG', 164, 34, 25, 12, undefined, 'FAST')
    } catch { /* Logo is optional if the hosted image cannot be fetched by the browser. */ }
  }
  pdf.setTextColor(35, 45, 62)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('FACTURÉ À', 17, 67)
  pdf.setFont('helvetica', 'normal')
  pdf.text(row.clientName, 17, 74)
  if (row.clientPhone) pdf.text(row.clientPhone, 17, 80)
  if (row.clientAddress) pdf.text(row.clientAddress, 17, 86, { maxWidth: 85 })
  pdf.text(`Émis le ${new Date(row.createdAt).toLocaleDateString('fr-FR')}`, 193, 74, { align: 'right' })
  if (row.dueDate) pdf.text(`Échéance : ${new Date(`${row.dueDate}T12:00:00`).toLocaleDateString('fr-FR')}`, 193, 80, { align: 'right' })
  const top = 101
  pdf.setFillColor(241, 244, 249)
  pdf.roundedRect(17, top, 176, 10, 2, 2, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  pdf.text('DÉSIGNATION', 21, top + 6.5)
  pdf.text('QTÉ', 127, top + 6.5, { align: 'right' })
  pdf.text('PRIX UNIT.', 158, top + 6.5, { align: 'right' })
  pdf.text('TOTAL', 188, top + 6.5, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  let y = top + 18
  items.forEach(item => {
    pdf.setFontSize(9.5)
    pdf.text(item.description || 'Prestation', 21, y, { maxWidth: 100 })
    pdf.text(String(item.quantity), 127, y, { align: 'right' })
    pdf.text(numberFmt.format(item.unitPrice), 158, y, { align: 'right' })
    pdf.text(numberFmt.format(item.quantity * item.unitPrice), 188, y, { align: 'right' })
    pdf.setDrawColor(231, 235, 241)
    pdf.line(17, y + 5, 193, y + 5)
    y += 13
  })
  y = Math.max(y + 5, 145)
  pdf.setFontSize(9)
  pdf.text('Total HT', 140, y)
  pdf.text(`${numberFmt.format(Number(row.subtotal))} FCFA`, 193, y, { align: 'right' })
  y += 7
  pdf.text(`Remise (${Number(row.discountPercent)} %)`, 140, y)
  pdf.text(`− ${numberFmt.format(Number(row.discountAmount))} FCFA`, 193, y, { align: 'right' })
  y += 9
  pdf.setFillColor(r, g, b)
  pdf.roundedRect(132, y - 5, 61, 13, 2, 2, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.text('NET À PAYER', 137, y + 3)
  pdf.text(`${numberFmt.format(Number(row.subtotal) - Number(row.discountAmount))} FCFA`, 188, y + 3, { align: 'right' })
  y += 15
  pdf.setTextColor(45, 55, 72)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Avance payée', 140, y)
  pdf.text(`${numberFmt.format(Number(row.advance))} FCFA`, 193, y, { align: 'right' })
  y += 7
  pdf.setFont('helvetica', 'bold')
  pdf.text('Reste à payer', 140, y)
  pdf.text(`${numberFmt.format(Number(row.total))} FCFA`, 193, y, { align: 'right' })
  y += 12
  if (row.notes) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('MODALITÉS DE PAIEMENT', 17, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row.notes, 17, y + 7, { maxWidth: 110 })
  }
  if (row.type === 'quote') {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.text('Devis valable 7 jours à compter de sa date d’émission.', 17, 245)
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(110, 120, 135)
  pdf.text('Merci pour votre confiance.', 17, 276)
  pdf.text('Cachet / Signature', 193, 264, { align: 'right' })
  pdf.setDrawColor(190, 198, 211)
  pdf.line(155, 270, 193, 270)
  if (profile.whatsapp) {
    const phone = profile.whatsapp.replace(/\D/g, '')
    const qr = await QRCode.toDataURL(`https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour ${profile.businessName}, je vous contacte au sujet du document ${row.number}.`)}`, { width: 120, margin: 1 })
    pdf.addImage(qr, 'PNG', 17, 246, 24, 24)
    pdf.setFontSize(7)
    pdf.text('Scannez pour contacter', 44, 260)
    pdf.text('sur WhatsApp', 44, 264)
  }
  pdf.save(`${row.number}.pdf`)
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [0, 2, 4].map(offset => parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number]
}

function FactureApp() {
  const [user, setUser] = useState<{ id: string; displayName?: string; email?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [profile, setProfile] = useState<BusinessProfilesRow | null>(null)
  const [clients, setClients] = useState<ClientsRow[]>([])
  const [documents, setDocuments] = useState<DocumentsRow[]>([])
  const [view, setView] = useState<View>('dashboard')
  const [profileDraft, setProfileDraft] = useState({ businessName: '', whatsapp: '', address: '', brandColor: '#1749D2' })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [docType, setDocType] = useState<'quote' | 'invoice'>('invoice')
  const [selectedClient, setSelectedClient] = useState('')
  const [newClient, setNewClient] = useState<ClientDraft | null>(null)
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unitPrice: 0 }])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [advance, setAdvance] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [workingId, setWorkingId] = useState('')

  useEffect(() => blink.auth.onAuthStateChanged(state => {
    setUser(state.user as typeof user)
    if (!state.isLoading) setAuthLoading(false)
  }), [])

  const reloadData = useCallback(async (userId: string) => {
    setDataLoading(true)
    try {
      const [profiles, clientRows, docRows] = await Promise.all([
        profileTable.list({ where: { userId }, limit: 1 }),
        clientsTable.list({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        documentsTable.list({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      ])
      const savedProfile = profiles[0] || null
      setProfile(savedProfile)
      setClients(clientRows)
      setDocuments(docRows)
      if (savedProfile) setProfileDraft({ businessName: savedProfile.businessName, whatsapp: savedProfile.whatsapp, address: savedProfile.address, brandColor: savedProfile.brandColor })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger vos données.')
    } finally { setDataLoading(false) }
  }, [])

  useEffect(() => {
    if (user?.id) {
      const userId = user.id
      queueMicrotask(() => { void reloadData(userId) })
    }
  }, [user?.id, reloadData])

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
  const remaining = Math.max(0, netTotal - (Number(advance) || 0))

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      let logoUrl = profile?.logoUrl || ''
      if (logoFile) {
        const extension = logoFile.name.split('.').pop() || 'png'
        const upload = await blink.storage.upload(logoFile, `business-logos/${user.id}-${Date.now()}.${extension}`)
        logoUrl = upload.publicUrl
      }
      const saved = await profileTable.upsert({ id: user.id, userId: user.id, ...profileDraft, logoUrl, updatedAt: new Date().toISOString() })
      setProfile(saved)
      setLogoFile(null)
      toast.success('Votre entreprise est enregistrée.')
      if (!profile) setView('dashboard')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.') }
    finally { setSaving(false) }
  }

  function resetComposer() {
    setDocType('invoice')
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
    const client = newClient?.name ? newClient : clients.find(row => row.id === selectedClient)
    if (!client?.name) { toast.error('Choisissez un client ou ajoutez-en un.'); return }
    if (!items.some(item => item.description.trim())) { toast.error('Ajoutez au moins une ligne au document.'); return }
    setSaving(true)
    try {
      let clientId: string | null = 'id' in client ? String(client.id) : null
      if (!clientId && newClient) {
        const createdClient = await clientsTable.create({ userId: user.id, ...newClient })
        clientId = createdClient.id
      }
      const prefix = docType === 'quote' ? 'DEV' : 'FAC'
      const number = `${prefix}-${new Date().getFullYear()}-${String(Math.floor(event.timeStamp)).slice(-6)}`
      await documentsTable.create({
        userId: user.id, number, type: docType, clientId,
        clientName: client.name, clientPhone: client.phone, clientAddress: client.address,
        itemsJson: JSON.stringify(items.filter(item => item.description.trim())),
        subtotal, discountPercent: Number(discountPercent) || 0, discountAmount, advance: Number(advance) || 0,
        total: remaining, status: 'unpaid', notes, dueDate,
      })
      await reloadData(user.id)
      setComposerOpen(false)
      resetComposer()
      setView('documents')
      toast.success(`${docType === 'quote' ? 'Devis' : 'Facture'} enregistré${docType === 'quote' ? '' : 'e'} avec succès.`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le document.') }
    finally { setSaving(false) }
  }

  async function togglePayment(row: DocumentsRow) {
    setWorkingId(row.id)
    try {
      await documentsTable.update(row.id, { status: row.status === 'paid' ? 'unpaid' : 'paid' })
      if (user) await reloadData(user.id)
      toast.success(row.status === 'paid' ? 'Document marqué comme impayé.' : 'Paiement confirmé, document marqué payé.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Mise à jour impossible.') }
    finally { setWorkingId('') }
  }

  async function convertQuote(row: DocumentsRow) {
    if (!user) return
    setWorkingId(row.id)
    try {
      await documentsTable.create({
        userId: user.id, number: `FAC-${new Date().getFullYear()}-${String(documents.length + 1).padStart(6, '0')}`,
        type: 'invoice', clientId: row.clientId, clientName: row.clientName, clientPhone: row.clientPhone,
        clientAddress: row.clientAddress, itemsJson: row.itemsJson, subtotal: Number(row.subtotal),
        discountPercent: Number(row.discountPercent), discountAmount: Number(row.discountAmount), advance: Number(row.advance),
        total: Number(row.total), status: 'unpaid', notes: row.notes, dueDate: row.dueDate,
      })
      await reloadData(user.id)
      toast.success('Le devis a été converti en facture.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Conversion impossible.') }
    finally { setWorkingId('') }
  }

  async function downloadPdf(row: DocumentsRow) {
    if (!profile) { toast.error('Complétez le profil de votre entreprise avant de générer un PDF.'); return }
    try { await createDocumentPdf(row, profile); toast.success('Votre PDF est prêt à être téléchargé.') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'La génération du PDF a échoué.') }
  }

  function shareOnWhatsApp(row: DocumentsRow) {
    const phone = row.clientPhone.replace(/\D/g, '')
    const message = `Bonjour ${row.clientName}, voici le ${row.type === 'quote' ? 'devis' : 'document'} ${row.number} de ${money(row.total)}. Je vous joins le PDF dans cette conversation.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    toast('WhatsApp est ouvert. Téléchargez puis joignez le PDF à la conversation.')
  }

  if (authLoading) return <div className="flex min-h-dvh items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>
  if (!user) return <main className="flex min-h-[80vh] items-center justify-center p-5"><div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm"><div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><FileText className="size-7" /></div><h1 className="text-2xl font-bold tracking-tight">Vos factures, en un éclair.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Connectez-vous pour créer vos devis et factures, retrouver vos clients et enregistrer vos documents en toute sécurité.</p><button onClick={() => blink.auth.login(window.location.href)} className="mt-7 h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] active:scale-[.98]">Se connecter ou créer un compte</button><p className="mt-4 text-xs text-muted-foreground">La création de compte se fait sur la page sécurisée de connexion.</p></div></main>

  if (dataLoading && !profile) return <div className="flex min-h-[70vh] items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>

  if (!profile || view === 'settings') return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12"><button onClick={() => setView('dashboard')} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Retour au tableau de bord</button><div className="mb-7"><span className="text-xs font-bold uppercase tracking-[.18em] text-primary">Configuration</span><h1 className="mt-2 text-3xl font-bold tracking-tight">{profile ? 'Votre entreprise' : 'Présentez votre entreprise'}</h1><p className="mt-2 text-sm text-muted-foreground">Ces informations apparaîtront sur vos devis, factures et PDF.</p></div><form onSubmit={saveProfile} className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"><div><label className={labelClass}>Nom de votre entreprise *</label><input required className={inputClass} value={profileDraft.businessName} onChange={e => setProfileDraft({ ...profileDraft, businessName: e.target.value })} placeholder="Ex. Atelier Créatif Cotonou" /></div><div className="grid gap-5 sm:grid-cols-2"><div><label className={labelClass}>WhatsApp professionnel *</label><input required className={inputClass} value={profileDraft.whatsapp} onChange={e => setProfileDraft({ ...profileDraft, whatsapp: e.target.value })} placeholder="+229 01 00 00 00 00" /></div><div><label className={labelClass}>Couleur de marque</label><div className="flex h-11 items-center gap-3 rounded-xl border border-border px-3"><input type="color" aria-label="Couleur de marque" value={profileDraft.brandColor} onChange={e => setProfileDraft({ ...profileDraft, brandColor: e.target.value })} className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0" /><span className="text-sm text-muted-foreground">Personnalisez vos documents</span></div></div></div><div><label className={labelClass}>Adresse</label><input className={inputClass} value={profileDraft.address} onChange={e => setProfileDraft({ ...profileDraft, address: e.target.value })} placeholder="Quartier, ville, pays" /></div><div><label className={labelClass}>Logo de votre entreprise</label><label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-border p-4 transition hover:border-primary/50 hover:bg-muted/40"><span className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-secondary text-primary">{profile?.logoUrl && !logoFile ? <img src={profile.logoUrl} alt="Logo actuel" className="size-full object-cover" /> : <Building2 className="size-6" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{logoFile?.name || 'Choisir une image'}</span><span className="mt-1 block text-xs text-muted-foreground">PNG ou JPG, votre logo sera ajouté à vos PDF</span></span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => setLogoFile(e.target.files?.[0] || null)} /></label></div><button disabled={saving} className="h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:scale-[1.01] disabled:opacity-60 sm:w-auto">{saving ? 'Enregistrement…' : 'Enregistrer mon entreprise'}</button></form></main>

  return <div className="min-h-full px-4 py-6 sm:px-7 lg:px-10 lg:py-8"><div className="mx-auto max-w-7xl"><header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><span className="size-2 rounded-full bg-accent-foreground" /> Espace professionnel</div><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{view === 'dashboard' ? 'Tableau de bord' : view === 'documents' ? 'Mes documents' : 'Mes clients'}</h1><p className="mt-1 text-sm text-muted-foreground">Bonjour {user.displayName?.split(' ')[0] || profile.businessName}, suivez votre activité en FCFA.</p></div><div className="flex items-center gap-2"><button onClick={() => setView('settings')} className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Paramètres entreprise"><Settings2 className="size-4" /></button><button onClick={() => { resetComposer(); setComposerOpen(true) }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.02] active:scale-[.98]"><Plus className="size-4" /><span className="hidden sm:inline">Créer un document</span><span className="sm:hidden">Créer</span></button></div></header>

  <nav className="mb-7 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5" aria-label="Navigation principale">{([['dashboard', 'Vue d’ensemble', LayoutDashboard], ['documents', 'Documents', ClipboardList], ['clients', 'Clients', Users]] as const).map(([key, label, Icon]) => <button key={key} onClick={() => { setView(key); setSearch('') }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${view === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-4" />{label}</button>)}</nav>

  {view === 'dashboard' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[{ label: 'Chiffre d’affaires ce mois', value: totals.monthRevenue, icon: Wallet, tone: 'bg-secondary text-primary', hint: 'Documents payés ce mois-ci' }, { label: 'En attente', value: totals.pendingTotal, icon: CircleHelp, tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', hint: 'Reste à encaisser' }, { label: 'Total payé', value: totals.paidTotal, icon: Check, tone: 'bg-accent text-accent-foreground', hint: 'Tous les documents réglés' }].map(card => <div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{card.label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{money(card.value)}</p></div><span className={`flex size-10 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="size-5" /></span></div><p className="mt-4 text-xs text-muted-foreground">{card.hint}</p></div>)}</div>
  <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Revenus encaissés</h2><p className="mt-1 text-xs text-muted-foreground">Évolution sur les 6 derniers mois</p></div><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">FCFA</span></div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={value => numberFmt.format(value)} /><Tooltip formatter={value => [money(String(value)), 'Encaissé']} cursor={{ fill: 'var(--muted)' }} /><Bar dataKey="amount" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={42} /></BarChart></ResponsiveContainer></div></section><section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Démarrer rapidement</h2><p className="mt-1 text-xs text-muted-foreground">Les essentiels pour votre activité</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><FilePlus2 className="size-5" /></span></div><div className="mt-5 space-y-3">{[{ title: 'Créer un devis ou une facture', desc: 'Ajoutez des lignes et envoyez un PDF', action: () => { resetComposer(); setComposerOpen(true) }, icon: FileText }, { title: 'Consulter mes clients', desc: `${clients.length} client${clients.length > 1 ? 's' : ''} enregistré${clients.length > 1 ? 's' : ''}`, action: () => setView('clients'), icon: Users }].map(item => <button key={item.title} onClick={item.action} className="flex w-full items-center gap-3 rounded-xl border border-border p-3.5 text-left transition hover:border-primary/30 hover:bg-muted/50"><span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground"><item.icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.desc}</span></span><ChevronRight className="size-4 text-muted-foreground" /></button>)}</div></section></div>
  <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Derniers documents</h2><p className="mt-1 text-xs text-muted-foreground">Vos devis et factures les plus récents</p></div><button onClick={() => setView('documents')} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Tout voir <ArrowRight className="size-4" /></button></div><DocumentList rows={documents.slice(0, 5)} onDownload={downloadPdf} onShare={shareOnWhatsApp} onToggle={togglePayment} onConvert={convertQuote} workingId={workingId} emptyLabel="Vos premiers documents apparaîtront ici." /></section></>}

  {view === 'documents' && <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Tous vos documents</h2><p className="mt-1 text-xs text-muted-foreground">{documents.length} document{documents.length > 1 ? 's' : ''} enregistré{documents.length > 1 ? 's' : ''}</p></div><input className={`${inputClass} sm:max-w-xs`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un numéro ou client…" aria-label="Rechercher un document" /></div><DocumentList rows={filteredDocuments} onDownload={downloadPdf} onShare={shareOnWhatsApp} onToggle={togglePayment} onConvert={convertQuote} workingId={workingId} emptyLabel={search ? 'Aucun document ne correspond à votre recherche.' : 'Créez votre premier devis ou votre première facture.'} /></section>}

  {view === 'clients' && <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Votre carnet clients</h2><p className="mt-1 text-xs text-muted-foreground">Le total dépensé correspond aux factures marquées comme payées.</p></div><input className={`${inputClass} sm:max-w-xs`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client…" aria-label="Rechercher un client" /></div>{filteredClients.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredClients.map(client => <article key={client.id} className="rounded-xl border border-border p-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">{client.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{client.name}</h3><p className="truncate text-xs text-muted-foreground">{client.phone || 'Téléphone non renseigné'}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs"><span className="text-muted-foreground">Total dépensé</span><strong>{money(documents.filter(doc => doc.clientId === client.id && doc.status === 'paid').reduce((sum, doc) => sum + Number(doc.total), 0))}</strong></div>{client.address && <p className="mt-2 truncate text-xs text-muted-foreground">{client.address}</p>}</article>)}</div> : <EmptyState icon={Users} label={search ? 'Aucun client trouvé.' : 'Vos clients seront ajoutés quand vous créerez un document.'} />}</section>}
  </div>

  {composerOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="composer-title" className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-border bg-background p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="mb-6 flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-[.16em] text-primary">Nouveau document</span><h2 id="composer-title" className="mt-1 text-2xl font-bold">Créer votre document</h2><p className="mt-1 text-sm text-muted-foreground">Les montants sont calculés automatiquement en FCFA.</p></div><button onClick={() => setComposerOpen(false)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Fermer"><X className="size-5" /></button></div><form onSubmit={saveDocument} className="space-y-5"><div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">{(['invoice', 'quote'] as const).map(type => <button type="button" key={type} onClick={() => setDocType(type)} className={`h-10 rounded-lg text-sm font-semibold transition ${docType === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{type === 'invoice' ? 'Facture' : 'Devis'}</button>)}</div><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><label className={labelClass}>Client *</label>{newClient ? <div className="grid gap-2 sm:grid-cols-3"><input className={inputClass} required placeholder="Nom complet" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} /><input className={inputClass} placeholder="Téléphone / WhatsApp" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} /><input className={inputClass} placeholder="Adresse" value={newClient.address} onChange={e => setNewClient({ ...newClient, address: e.target.value })} /></div> : <select className={inputClass} value={selectedClient} onChange={e => setSelectedClient(e.target.value)} required><option value="">Sélectionner un client…</option>{clients.map(client => <option value={client.id} key={client.id}>{client.name} · {client.phone}</option>)}</select>}</div><div className="flex items-end">{newClient ? <button type="button" onClick={() => setNewClient(null)} className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted"><X className="size-3.5" /> Annuler</button> : <button type="button" onClick={() => { setNewClient({ name: '', phone: '', address: '' }); setSelectedClient('') }} className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted"><Plus className="size-3.5" /> Nouveau client</button>}</div></div><div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Lignes du document</h3><button type="button" onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-4" /> Ajouter une ligne</button></div>{items.map((item, index) => <div key={index} className="grid grid-cols-12 gap-2 rounded-xl border border-border p-3"><div className="col-span-12 sm:col-span-5"><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">DÉSIGNATION</label><input className={inputClass} required={index === 0} placeholder="Ex. Création de logo" value={item.description} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} /></div><div className="col-span-4 sm:col-span-2"><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">QUANTITÉ</label><input type="number" min="1" step="1" className={inputClass} value={item.quantity} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, quantity: Number(e.target.value) } : row))} /></div><div className="col-span-5 sm:col-span-3"><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">PRIX UNIT. FCFA</label><input type="number" min="0" step="1" className={inputClass} value={item.unitPrice || ''} onChange={e => setItems(items.map((row, i) => i === index ? { ...row, unitPrice: Number(e.target.value) } : row))} placeholder="0" /></div><div className="col-span-3 flex items-end justify-end text-xs font-semibold sm:col-span-2">{money(item.quantity * item.unitPrice)}{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="ml-2 text-muted-foreground hover:text-destructive" aria-label="Supprimer la ligne"><X className="size-4" /></button>}</div></div>)}</div><div className="grid gap-4 sm:grid-cols-3"><div><label className={labelClass}>Remise (%)</label><input type="number" min="0" max="100" className={inputClass} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} /></div><div><label className={labelClass}>Avance payée (FCFA)</label><input type="number" min="0" className={inputClass} value={advance || ''} onChange={e => setAdvance(Number(e.target.value))} placeholder="0" /></div><div><label className={labelClass}>Date d’échéance</label><input type="date" min={today()} className={inputClass} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div></div><div><label className={labelClass}>Notes et paiement</label><textarea className="min-h-20 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payable via MTN MoMo / Moov Money au : XX" /></div><div className="rounded-2xl bg-muted/70 p-4"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Total HT</span><strong>{money(subtotal)}</strong></div><div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Remise ({Number(discountPercent) || 0} %)</span><strong>− {money(discountAmount)}</strong></div><div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold"><span>NET À PAYER</span><span>{money(netTotal)}</span></div><div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Reste après avance</span><strong className="text-primary">{money(remaining)}</strong></div></div><div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setComposerOpen(false)} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-muted">Annuler</button><button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? 'Enregistrement…' : <><Check className="size-4" /> Enregistrer {docType === 'quote' ? 'le devis' : 'la facture'}</>}</button></div></form></section></div>}
  </div>
}

function DocumentList({ rows, onDownload, onShare, onToggle, onConvert, workingId, emptyLabel }: { rows: DocumentsRow[]; onDownload: (row: DocumentsRow) => void; onShare: (row: DocumentsRow) => void; onToggle: (row: DocumentsRow) => void; onConvert: (row: DocumentsRow) => void; workingId: string; emptyLabel: string }) {
  if (!rows.length) return <EmptyState icon={FileText} label={emptyLabel} />
  return <div className="divide-y divide-border">{rows.map(row => <article key={row.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${row.type === 'quote' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-secondary text-primary'}`}><FileText className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{row.number}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{row.type === 'quote' ? 'Devis' : 'Facture'}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.status === 'paid' ? 'bg-accent text-accent-foreground' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{row.status === 'paid' ? 'Payé' : 'Impayé'}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{row.clientName} · {new Date(row.createdAt).toLocaleDateString('fr-FR')}</p></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><strong className="whitespace-nowrap text-sm">{money(row.total)}</strong><div className="flex items-center gap-1"><button onClick={() => onDownload(row)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary" aria-label="Télécharger le PDF" title="Télécharger le PDF"><ArrowDownToLine className="size-4" /></button><button onClick={() => onShare(row)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-accent-foreground" aria-label="Partager sur WhatsApp" title="Partager sur WhatsApp"><MessageCircle className="size-4" /></button><button disabled={workingId === row.id} onClick={() => onToggle(row)} className="rounded-lg border border-border px-2.5 py-2 text-[11px] font-semibold transition hover:bg-muted disabled:opacity-50">{row.status === 'paid' ? 'Impayé' : 'Marquer payé'}</button>{row.type === 'quote' && <button disabled={workingId === row.id} onClick={() => onConvert(row)} className="flex size-9 items-center justify-center rounded-lg text-primary transition hover:bg-secondary disabled:opacity-50" aria-label="Transformer en facture" title="Transformer en facture"><ArrowRight className="size-4" /></button>}</div></div></article>)}</div>
}

function EmptyState({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-5 py-12 text-center"><span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" /></span><p className="max-w-sm text-sm text-muted-foreground">{label}</p></div>
}
