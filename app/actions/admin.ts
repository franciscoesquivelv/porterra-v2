'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'

type UpdatableStatus = 'active' | 'rejected' | 'suspended'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getAdminClient() as any }

export async function updateUserStatusAction(
  targetUserId: string,
  newStatus: UpdatableStatus,
): Promise<{ error?: string }> {
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const callerRole = user.app_metadata?.porterra_role
  if (callerRole !== 'admin') return { error: 'Sin permisos' }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? 'unknown'
  const ua = headersList.get('user-agent') ?? 'unknown'

  // Actualizar en public.profiles
  const { error: profileError } = await db()
    .from('profiles')
    .update({ porterra_status: newStatus })
    .eq('user_id', targetUserId)

  if (profileError) return { error: 'Error al actualizar el perfil' }

  // Sincronizar en auth.users app_metadata
  const admin = getAdminClient()
  const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { porterra_status: newStatus },
  })

  if (authError) {
    // Revertir perfil
    await db()
      .from('profiles')
      .update({ porterra_status: 'pending' })
      .eq('user_id', targetUserId)
    return { error: 'Error al sincronizar autenticación' }
  }

  const eventMap: Record<UpdatableStatus, 'admin.user.approved' | 'admin.user.rejected' | 'admin.user.suspended'> = {
    active:    'admin.user.approved',
    rejected:  'admin.user.rejected',
    suspended: 'admin.user.suspended',
  }

  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'admin',
    actorIp:        ip,
    actorUserAgent: ua,
    eventType:      eventMap[newStatus],
    entityType:     'user',
    entityId:       targetUserId,
    metadata:       { new_status: newStatus },
  })

  // Si el admin activa la cuenta de un carrier, también lo marca como verificado.
  // En producción esto sería un paso separado (verificación de documentos físicos),
  // pero para el prototipo la aprobación de cuenta implica verificación.
  if (newStatus === 'active') {
    const { data: profile } = await db()
      .from('profiles')
      .select('porterra_role')
      .eq('user_id', targetUserId)
      .single()

    if (profile?.porterra_role === 'carrier') {
      await db()
        .from('carrier_profiles')
        .update({ is_verified: true, verification_date: new Date().toISOString() })
        .eq('user_id', targetUserId)
    }
  }

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin')

  return {}
}

// ─── UPDATE KYC STATUS ────────────────────────────────────────────────────────

type KycAction = 'approved' | 'rejected'

export async function updateKycStatusAction(
  targetUserId: string,
  newKycStatus: KycAction,
  notes?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin') return { error: 'Sin permisos' }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? 'unknown'
  const ua = headersList.get('user-agent') ?? 'unknown'

  // Primero leer metadata existente para no borrar datos del formulario KYC
  const { data: existing } = await db()
    .from('profiles')
    .select('metadata')
    .eq('user_id', targetUserId)
    .single() as { data: { metadata: Record<string, string> | null } | null }

  const mergedMeta = {
    ...(existing?.metadata ?? {}),
    ...(notes ? {
      kyc_notes:       notes,
      kyc_reviewed_by: user.id,
      kyc_reviewed_at: new Date().toISOString(),
    } : {
      kyc_reviewed_by: user.id,
      kyc_reviewed_at: new Date().toISOString(),
    }),
  }

  const { error } = await db()
    .from('profiles')
    .update({ kyc_status: newKycStatus, metadata: mergedMeta })
    .eq('user_id', targetUserId)

  if (error) return { error: 'Error al actualizar KYC' }

  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'admin',
    actorIp:        ip,
    actorUserAgent: ua,
    eventType:      newKycStatus === 'approved' ? 'user.kyc.approved' : 'user.kyc.rejected',
    entityType:     'user',
    entityId:       targetUserId,
    metadata:       { kyc_status: newKycStatus, notes },
  })

  revalidatePath('/admin/kyc')
  revalidatePath('/admin/usuarios')
  revalidatePath('/admin')

  return {}
}

// ─── UPDATE PLATFORM CONFIG ───────────────────────────────────────────────────

export async function updateConfigAction(
  key: string,
  value: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin') return { error: 'Sin permisos' }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? 'unknown'
  const ua = headersList.get('user-agent') ?? 'unknown'

  const { error } = await db()
    .from('platform_config')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key)

  if (error) return { error: 'Error al guardar configuración' }

  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'admin',
    actorIp:        ip,
    actorUserAgent: ua,
    eventType:      'admin.config.changed',
    entityType:     'platform_config',
    entityId:       key,
    metadata:       { key, value },
  })

  revalidatePath('/admin/configuracion')

  return {}
}
