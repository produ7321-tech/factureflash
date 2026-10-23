import type { InvoiceTemplateData, InvoiceTemplateId } from './templates'

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const money = (value: number) => `${number.format(value)} FCFA`

export function InvoiceTemplatePreview({ template, data }: { template: InvoiceTemplateId; data: InvoiceTemplateData }) {
  const brandColor = template === 'benin' ? '#138a55' : template === 'premium-dark' ? '#c7a25a' : data.brandColor || '#1749d2'
  const background = template === 'premium-dark' ? '#101114' : '#ffffff'
  const foreground = template === 'premium-dark' ? '#f6f3ec' : '#182033'
  const thermal = template === 'thermal'
  const minimal = template === 'minimal'
  const elegant = template === 'elegant'
  const modern = template === 'modern'
  const vat = data.vatEnabled ? Math.round(data.subtotal * 0.18) : 0

  return (
    <article className={`mx-auto w-full border p-5 shadow-sm sm:p-8 ${minimal ? 'border-transparent shadow-none' : ''}`} style={{ maxWidth: thermal ? '360px' : '760px', background, color: foreground, borderColor: template === 'benin' ? '#e8d578' : minimal ? 'transparent' : '#e5e7eb', fontFamily: thermal ? 'ui-monospace, monospace' : 'inherit' }}>
      {modern && <div className="-mx-5 -mt-5 mb-6 h-3 rounded-t-xl sm:-mx-8 sm:-mt-8" style={{ background: brandColor }} />}
      <header className={`flex items-start justify-between gap-4 border-b pb-5 ${minimal ? 'border-slate-100' : ''} ${elegant ? 'flex-col' : ''}`} style={{ borderColor: minimal ? '#f1f5f9' : `${brandColor}55` }}>
        <div className="flex min-w-0 items-center gap-3">
          {data.logoUrl && <img src={data.logoUrl} alt="Logo entreprise" className={`${elegant ? 'size-24' : 'size-12'} rounded-lg object-contain`} />}
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold" style={{ color: brandColor }}>{data.businessName || 'Votre entreprise'}</h2>
            <p className="mt-1 text-xs opacity-70">{data.businessAddress || 'Cotonou, Bénin'}</p>
            <p className="text-xs opacity-70">{data.businessPhone || '+229 00 00 00 00'}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-xs font-semibold uppercase tracking-widest ${minimal ? 'text-slate-500' : ''}`}>Facture</p>
          <p className="mt-1 font-mono text-sm">{data.invoiceNumber}</p>
          <p className="mt-1 text-xs opacity-70">{data.issueDate}</p>
        </div>
      </header>
      {template === 'benin' && <p className="mt-4 text-xs" style={{ color: brandColor }}>RCCM : {data.rccm || 'À compléter'} · IFU : {data.ifu || 'À compléter'} · Bénin</p>}
      <section className="py-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">Facturé à</p>
        <p className="mt-1 font-semibold">{data.clientName || 'Nom du client'}</p>
        {data.clientAddress && <p className="text-sm opacity-70">{data.clientAddress}</p>}
      </section>
      <table className="w-full border-collapse text-left text-sm">
        <thead><tr style={{ background: minimal ? 'transparent' : `${brandColor}12` }}><th className="px-2 py-2">Désignation</th>{!thermal && <th className="px-2 py-2 text-right">Qté</th>}<th className="px-2 py-2 text-right">Prix</th>{!thermal && <th className="px-2 py-2 text-right">Total</th>}</tr></thead>
        <tbody>{data.items.map((item, index) => <tr key={`${item.description}-${index}`} className="border-b" style={{ borderColor: `${brandColor}20` }}><td className="px-2 py-2">{item.description || 'Prestation'}{thermal ? ` × ${item.quantity}` : ''}</td>{!thermal && <td className="px-2 py-2 text-right">{item.quantity}</td>}<td className="px-2 py-2 text-right">{money(item.unitPrice)}</td>{!thermal && <td className="px-2 py-2 text-right">{money(item.quantity * item.unitPrice)}</td>}</tr>)}</tbody>
      </table>
      <div className="ml-auto mt-5 max-w-xs space-y-2 text-sm">
        <p className="flex justify-between"><span>Sous-total</span><span>{money(data.subtotal)}</span></p>
        {data.discount > 0 && <p className="flex justify-between"><span>Remise</span><span>− {money(data.discount)}</span></p>}
        {data.vatEnabled && <p className="flex justify-between"><span>TVA (18 %)</span><span>{money(vat)}</span></p>}
        <p className="flex justify-between border-t pt-3 text-base font-bold" style={{ borderColor: brandColor, color: brandColor }}><span>Total à payer</span><span>{money(data.total + vat)}</span></p>
      </div>
      <footer className="mt-8 flex items-end justify-between border-t pt-4 text-xs opacity-70" style={{ borderColor: `${brandColor}55` }}><p>Merci pour votre confiance · FactureFlash 229</p>{data.paymentUrl && <img src={data.paymentUrl} alt="QR code de paiement" className="size-16" />}</footer>
    </article>
  )
}
