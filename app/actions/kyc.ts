'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import { headers } from 'next/headers'

interface KycFormData {
  company_legal_name: string
  tax_id: string
  tax_id_country: string
  license_number: string
  legal_rep_name: string
  legal_rep_id: string
}

export async function submitKycAction(
  form: KycFormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? 'unknown'
  const ua = headersList.get('user-agent') ?? 'unknown'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Guardar datos del formulario en metadata y actualizar kyc_status a 'submitted'
  const { error } = await db
    .from('profiles')
    .update({
      kyc_status: 'submitted',
      metadata: {
        company_legal_name: form.company_legal_name,
        tax_id:             form.tax_id,
        tax_id_country:     form.tax_id_country,
        license_number:     form.license_number,
        legal_rep_name:     form.legal_rep_name,
        legal_rep_id:       form.legal_rep_id,
        submitted_at:       new Date().toISOString(),
      },
    })
    .eq('user_id', user.id)

  if (error) return { error: 'Error al guardar la información. Intenta de nuevo.' }

  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'freight_forwarder',
    actorIp:        ip,
    actorUserAgent: ua,
    eventType:      'user.kyc.submitted',
    entityType:     'user',
    entityId:       user.id,
    metadata:       { company_legal_name: form.company_legal_name },
  })

  revalidatePath('/ff/perfil')
  revalidatePath('/admin/kyc')

  return {}
}
