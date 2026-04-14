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

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin')

  return {}
}
