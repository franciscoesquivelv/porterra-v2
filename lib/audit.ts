// ─────────────────────────────────────────────────────────────────────────────
// PORTERRA V2 — Audit Log
// ⛔ logAuditEvent DEBE llamarse en CADA acción de negocio relevante
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'crypto'
import { getAdminClient } from '@/lib/supabase/admin'
import type { AuditEventType, UserRole } from '@/types/database.types'

interface AuditEventParams {
  actorUserId: string
  actorRole: UserRole
  actorIp?: string
  actorUserAgent?: string
  eventType: AuditEventType
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  const payload = {
    actor_user_id:    params.actorUserId,
    actor_role:       params.actorRole,
    actor_ip:         params.actorIp ?? null,
    actor_user_agent: params.actorUserAgent ?? null,
    event_type:       params.eventType,
    event_category:   params.eventType.split('.')[0],
    entity_type:      params.entityType ?? null,
    entity_id:        params.entityId ?? null,
    metadata:         params.metadata ?? {},
    created_at:       new Date().toISOString(),
  }

  const checksum = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (getAdminClient() as any)
    .from('audit_log')
    .insert({ ...payload, checksum })

  if (error) {
    console.error('[PORTERRA AUDIT] Error al insertar evento:', (error as Error).message)
  }
}
