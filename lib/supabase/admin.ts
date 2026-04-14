// ─────────────────────────────────────────────────────────────────────────────
// PORTERRA V2 — Supabase Admin Client (Service Role)
// ⛔ SOLO usar en Server Actions / Route Handlers / Scripts de migración
// ⛔ NUNCA importar desde componentes del cliente
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Singleton para evitar múltiples instancias en desarrollo
let adminClient: ReturnType<typeof createClient<Database>> | null = null

export function getAdminClient() {
  if (adminClient) return adminClient

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada')
  }

  adminClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return adminClient
}
