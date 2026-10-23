import { randomUUID } from 'node:crypto'
import pg, { type QueryResultRow } from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (typeof window !== 'undefined') {
  throw new Error('The PostgreSQL pool is server-only. Do not import it into browser code.')
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set in the server environment.')
}

if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error('DATABASE_URL must be a PostgreSQL connection string.')
}

const databasePool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 60_000,
})

export const storageTables = ['businesses', 'business_profiles', 'clients', 'invoices', 'documents', 'quotes', 'invoice_items'] as const
export type StorageTable = typeof storageTables[number]
export type StorageRecord = Record<string, unknown> & {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
  number?: string
}

type JsonRow = QueryResultRow & {
  id: string
  user_id: string
  number?: string
  created_at: Date | string
  updated_at: Date | string
  data: unknown
}

function assertUserId(userId: string) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(userId)) {
    throw new Error('A valid UUID user ID is required.')
  }
}

function parseData(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toRecord(row: JsonRow): StorageRecord {
  return {
    ...parseData(row.data),
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    ...(row.number === undefined ? {} : { number: row.number }),
  }
}

function hasNumberColumn(table: StorageTable) {
  return table === 'invoices' || table === 'documents' || table === 'quotes'
}

async function findById(table: StorageTable, userId: string, id: string) {
  const numberColumn = hasNumberColumn(table) ? ', number' : ''
  const result = await databasePool.query<JsonRow>(
    `SELECT id, user_id, created_at, updated_at, data${numberColumn} FROM ${table} WHERE user_id = $1 AND id = $2 LIMIT 1`,
    [userId, id],
  )
  return result.rows[0]
}

/** Server-only PostgreSQL persistence. Never import this module from browser components. */
export const postgresStorage = {
  async listRecords(table: StorageTable, userId: string): Promise<StorageRecord[]> {
    assertUserId(userId)
    const numberColumn = hasNumberColumn(table) ? ', number' : ''
    const result = await databasePool.query<JsonRow>(
      `SELECT id, user_id, created_at, updated_at, data${numberColumn} FROM ${table} WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    )
    return result.rows.map(toRecord)
  },

  async createRecord(table: StorageTable, userId: string, data: Record<string, unknown>): Promise<StorageRecord> {
    assertUserId(userId)
    const id = typeof data.id === 'string' && /^[\da-f-]{36}$/i.test(data.id) ? data.id : randomUUID()
    const now = new Date()
    const number = hasNumberColumn(table) ? String(data.number ?? '') : undefined
    const storedData = { ...data, id, userId, createdAt: now.toISOString(), updatedAt: now.toISOString() }
    if (table === 'business_profiles') {
      const result = await databasePool.query<JsonRow>(
        `INSERT INTO business_profiles (id, user_id, created_at, updated_at, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
         RETURNING id, user_id, created_at, updated_at, data`,
        [id, userId, now, now, JSON.stringify(storedData)],
      )
      if (!result.rows[0]) throw new Error('Unable to read the saved business profile.')
      return toRecord(result.rows[0])
    }
    if (hasNumberColumn(table)) {
      await databasePool.query(
        `INSERT INTO ${table} (id, user_id, number, created_at, updated_at, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [id, userId, number, now, now, JSON.stringify(storedData)],
      )
    } else {
      await databasePool.query(
        `INSERT INTO ${table} (id, user_id, created_at, updated_at, data) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [id, userId, now, now, JSON.stringify(storedData)],
      )
    }
    const row = await findById(table, userId, id)
    if (!row) throw new Error(`Unable to read the newly created ${table} record.`)
    return toRecord(row)
  },

  async upsertProfile(userId: string, data: Record<string, unknown>): Promise<StorageRecord> {
    assertUserId(userId)
    const result = await databasePool.query<QueryResultRow & { id: string }>(
      'SELECT id FROM business_profiles WHERE user_id = $1 LIMIT 1',
      [userId],
    )
    return this.createRecord('business_profiles', userId, {
      ...data,
      ...(result.rows[0] ? { id: result.rows[0].id } : {}),
    })
  },

  async updateRecord(table: StorageTable, userId: string, id: string, changes: Record<string, unknown>): Promise<StorageRecord> {
    assertUserId(userId)
    const existing = await findById(table, userId, id)
    if (!existing) throw new Error('Record not found.')
    const data: Record<string, unknown> = { ...parseData(existing.data), ...changes, id: existing.id, userId: existing.user_id }
    if (hasNumberColumn(table)) {
      await databasePool.query(
        `UPDATE ${table} SET number = $1, data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND id = $4`,
        [String(data.number ?? existing.number ?? ''), JSON.stringify(data), userId, id],
      )
    } else {
      await databasePool.query(
        `UPDATE ${table} SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND id = $3`,
        [JSON.stringify(data), userId, id],
      )
    }
    const updated = await findById(table, userId, id)
    if (!updated) throw new Error('Unable to read the updated record.')
    return toRecord(updated)
  },

  async nextInvoiceNumber(userId: string, documentType: 'invoice' | 'quote'): Promise<string> {
    assertUserId(userId)
    const year = new Date().getFullYear()
    const result = await databasePool.query<QueryResultRow & { last_number: number }>(
      `INSERT INTO invoice_sequences (user_id, year, document_type, last_number)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, year, document_type)
       DO UPDATE SET last_number = invoice_sequences.last_number + 1
       RETURNING last_number`,
      [userId, year, documentType],
    )
    if (!result.rows[0]) throw new Error('Unable to allocate an invoice number.')
    const prefix = documentType === 'quote' ? 'DV' : 'FF'
    return `${prefix}-${year}-${String(result.rows[0].last_number).padStart(4, '0')}`
  },

  async isPro(userId: string): Promise<boolean> {
    assertUserId(userId)
    const result = await databasePool.query<QueryResultRow & { active: boolean }>(
      'SELECT active FROM subscriptions WHERE user_id = $1 LIMIT 1',
      [userId],
    )
    return result.rows[0]?.active === true
  },

  async countInvoices(userId: string): Promise<number> {
    assertUserId(userId)
    const result = await databasePool.query<QueryResultRow & { total: string }>(
      'SELECT COUNT(*) AS total FROM invoices WHERE user_id = $1',
      [userId],
    )
    return Number(result.rows[0]?.total ?? 0)
  },

  async activateSubscription(userId: string, transactionId: string) {
    assertUserId(userId)
    await databasePool.query(
      `INSERT INTO subscriptions (user_id, plan, active, provider_reference, updated_at)
       VALUES ($1, 'pro', TRUE, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
       SET plan = 'pro', active = TRUE, provider_reference = EXCLUDED.provider_reference, updated_at = CURRENT_TIMESTAMP`,
      [userId, transactionId],
    )
  },

  async listClients(userId: string) {
    return this.listRecords('clients', userId)
  },

  async createClient(input: { user_id: string; nom: string; tel?: string | null; email?: string | null }) {
    return this.createRecord('clients', input.user_id, {
      name: input.nom,
      phone: input.tel ?? '',
      email: input.email ?? '',
      address: '',
    })
  },

  async listInvoices(userId: string) {
    return this.listRecords('invoices', userId)
  },

  async createInvoice(input: { user_id: string; client_id?: string | null; numero: string; amount: number; status?: 'brouillon' | 'envoyee' | 'payee' }) {
    return this.createRecord('invoices', input.user_id, {
      clientId: input.client_id ?? null,
      amount: input.amount,
      status: input.status ?? 'brouillon',
      type: 'invoice',
      number: input.numero,
    })
  },

  async close() {
    await databasePool.end()
  },
}
