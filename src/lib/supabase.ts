import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Database = {
  public: {
    Tables: {
      subscriptions: {
        Row: { user_id: string; plan: 'free' | 'pro'; active: boolean; provider_reference: string | null; updated_at: string }
        Insert: { user_id: string; plan?: 'free' | 'pro'; active?: boolean; provider_reference?: string | null; updated_at?: string }
        Update: { plan?: 'free' | 'pro'; active?: boolean; provider_reference?: string | null; updated_at?: string }
        Relationships: []
      }
      business_profiles: { Row: StorageRow; Insert: StorageInsert; Update: StorageUpdate; Relationships: [] }
      documents: { Row: StorageRow & { number: string }; Insert: StorageInsert & { number: string }; Update: StorageUpdate; Relationships: [] }
      clients: { Row: StorageRow; Insert: StorageInsert; Update: StorageUpdate; Relationships: [] }
      invoices: { Row: StorageRow & { number: string }; Insert: StorageInsert & { number: string }; Update: StorageUpdate; Relationships: [] }
      quotes: { Row: StorageRow & { number: string }; Insert: StorageInsert & { number: string }; Update: StorageUpdate; Relationships: [] }
      invoice_items: { Row: StorageRow; Insert: StorageInsert; Update: StorageUpdate; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type StorageRow = { id: string; user_id: string; created_at: string; updated_at: string; data: Json }
type StorageInsert = { id?: string; user_id: string; created_at?: string; updated_at?: string; data?: Json }
type StorageUpdate = { data?: Json; updated_at?: string }

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase is not configured. Copy .env.example to .env and provide your project settings.')
}

export const supabase: SupabaseClient<Database> | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
        storage: typeof window === 'undefined' ? undefined : window.sessionStorage,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('La connexion sécurisée n’est pas configurée. Définissez les variables Supabase dans votre environnement.')
  }
  return supabase
}
