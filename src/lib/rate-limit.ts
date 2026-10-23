const WINDOW_MS = 60_000
const MAX_ACTIONS = 5
const KEY = 'factureflash:invoice-create-rate'

export function consumeInvoiceCreationSlot(now = Date.now()) {
  if (typeof window === 'undefined') return false
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]')
    const timestamps = Array.isArray(stored)
      ? stored.filter((value): value is number => typeof value === 'number' && now - value < WINDOW_MS)
      : []
    if (timestamps.length >= MAX_ACTIONS) return false
    timestamps.push(now)
    window.sessionStorage.setItem(KEY, JSON.stringify(timestamps))
    return true
  } catch {
    return false
  }
}
