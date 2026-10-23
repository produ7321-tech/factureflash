import type { BusinessProfilesRow, ClientsRow, DocumentsRow } from '@/lib/db-types'
import { supabase } from '@/lib/supabase'

type StorageTable = 'businesses' | 'business_profiles' | 'clients' | 'invoices' | 'documents' | 'quotes' | 'invoice_items'
type StorageRecord = { id: string; userId: string; createdAt: string; updatedAt: string; number?: string; [key: string]: unknown }
type RecordInput = Record<string, unknown>

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase?.auth.getSession() ?? { data: { session: null } }
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `Storage API request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}

function assertUserId(userId: string) {
  const value = userId.trim()
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) {
    throw new Error('Identifiant utilisateur UUID invalide.')
  }
  return value
}

async function listRecords<T extends StorageRecord>(table: StorageTable, userId: string): Promise<T[]> {
  const id = encodeURIComponent(assertUserId(userId))
  const result = await requestJson<{ records: T[] }>(`/api/storage?table=${table}&user_id=${id}`)
  return result.records
}

async function saveRecord<T>(
  action: 'create' | 'upsert' | 'update',
  table: StorageTable,
  userId: string,
  data: RecordInput,
  id?: string,
): Promise<T> {
  const result = await requestJson<{ record: T }>('/api/storage', {
    method: 'POST',
    body: JSON.stringify({ action, table, userId: assertUserId(userId), data, ...(id ? { id } : {}) }),
  })
  return result.record
}

export const storage = {
  db: {
    business_profiles: {
      async list(options: { where: { userId: string }; limit?: number }): Promise<BusinessProfilesRow[]> {
        const rows = await listRecords<StorageRecord>('business_profiles', options.where.userId)
        return (options.limit === undefined ? rows : rows.slice(0, options.limit)).map(row => row as unknown as BusinessProfilesRow)
      },
      async upsert(record: BusinessProfilesRow): Promise<BusinessProfilesRow> {
        return saveRecord<BusinessProfilesRow>('upsert', 'business_profiles', record.userId, record as unknown as RecordInput)
      },
    },
    clients: {
      async list(options: { where: { userId: string }; orderBy?: { createdAt: 'desc' } }): Promise<ClientsRow[]> {
        const rows = await listRecords<StorageRecord>('clients', options.where.userId)
        return rows.map(row => row as unknown as ClientsRow)
      },
      async create(input: { userId: string; name: string; phone: string; address: string }): Promise<ClientsRow> {
        return saveRecord<ClientsRow>('create', 'clients', input.userId, input)
      },
    },
    invoices: {
      async list(options: { where: { userId: string }; orderBy?: { createdAt: 'desc' } }): Promise<DocumentsRow[]> {
        const rows = await listRecords<StorageRecord>('invoices', options.where.userId)
        return rows.map(row => row as unknown as DocumentsRow)
      },
      async create(input: RecordInput & { userId: string }): Promise<DocumentsRow> {
        return saveRecord<DocumentsRow>('create', 'invoices', input.userId, input)
      },
      async update(id: string, changes: RecordInput, userId: string): Promise<DocumentsRow> {
        return saveRecord<DocumentsRow>('update', 'invoices', userId, changes, id)
      },
    },
    quotes: {
      async list(options: { where: { userId: string }; orderBy?: { createdAt: 'desc' } }): Promise<DocumentsRow[]> {
        const rows = await listRecords<StorageRecord>('quotes', options.where.userId)
        return rows.map(row => row as unknown as DocumentsRow)
      },
      async create(input: RecordInput & { userId: string }): Promise<DocumentsRow> {
        return saveRecord<DocumentsRow>('create', 'quotes', input.userId, input)
      },
      async update(id: string, changes: RecordInput, userId: string): Promise<DocumentsRow> {
        return saveRecord<DocumentsRow>('update', 'quotes', userId, changes, id)
      },
    },
    async nextInvoiceNumber(userId: string, documentType: 'invoice' | 'quote'): Promise<string> {
      const result = await requestJson<{ number: string }>('/api/storage', {
        method: 'POST',
        body: JSON.stringify({ action: 'nextNumber', userId: assertUserId(userId), documentType }),
      })
      return result.number
    },
    async isPro(userId: string): Promise<boolean> {
      const id = encodeURIComponent(assertUserId(userId))
      const result = await requestJson<{ active: boolean }>(`/api/storage?table=subscription&user_id=${id}`)
      return result.active
    },
  },
}
