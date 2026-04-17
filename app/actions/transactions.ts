'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import { headers } from 'next/headers'
import { z } from 'zod'

const CreateTransactionSchema = z.object({
  cargo_description:   z.string().min(5, 'Describe la carga (mín. 5 caracteres)'),
  cargo_type:          z.enum(['general', 'refrigerated', 'dangerous', 'oversized'] as const),
  total_amount_usd:    z.coerce.number().positive('El monto debe ser mayor a 0'),
  origin_country:      z.string().min(2, 'Selecciona el país de origen'),
  destination_country: z.string().min(2, 'Selecciona el país de destino'),
  cargo_weight_kg:     z.coerce.number().positive().optional().or(z.literal('')),
  cargo_volume_m3:     z.coerce.number().positive().optional().or(z.literal('')),
  origin_address:      z.string().optional(),
  destination_address: z.string().optional(),
  pickup_date:         z.string().optional(),
  delivery_date:       z.string().optional(),
})

type ActionState = { error: string; fieldErrors: Record<string, string>; success?: boolean }

export async function createTransactionAction(formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', fieldErrors: {} }
  if (user.app_metadata?.porterra_role !== 'freight_forwarder') return { error: 'Sin permisos', fieldErrors: {} }

  const raw = Object.fromEntries(formData)
  const parsed = CreateTransactionSchema.safeParse(raw)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString()
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { error: '', fieldErrors }
  }

  const d = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db.from('transactions').insert({
    ff_user_id:           user.id,
    cargo_description:    d.cargo_description,
    cargo_type:           d.cargo_type,
    total_amount_usd:     d.total_amount_usd,
    carrier_payout_usd:   Math.round(d.total_amount_usd * 0.975 * 100) / 100,
    origin_country:       d.origin_country,
    destination_country:  d.destination_country,
    cargo_weight_kg:      d.cargo_weight_kg || null,
    cargo_volume_m3:      d.cargo_volume_m3 || null,
    origin_address:       d.origin_address || null,
    destination_address:  d.destination_address || null,
    pickup_date:          d.pickup_date || null,
    delivery_date:        d.delivery_date || null,
    status:               'draft',
  })

  if (error) return { error: 'Error al crear la transacción. Intenta de nuevo.', fieldErrors: {} }

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'freight_forwarder',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'transaction.created',
    entityType:     'transaction',
    metadata:       { cargo: d.cargo_description, amount: d.total_amount_usd },
  })

  revalidatePath('/ff/transacciones')
  return { error: '', fieldErrors: {}, success: true }
}

// ── publishTransactionAction ──────────────────────────────────────────────────
//
// El FF terminó de configurar la carga y la publica al mercado de carriers.
// Una vez publicada, los carriers la pueden ver y aplicar.
// El FF puede despublicar si todavía no hay carrier asignado.
//
export async function publishTransactionAction(
  transactionId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'freight_forwarder')
    return { error: 'Sin permisos' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db
    .from('transactions')
    .update({ status: 'published' })
    .eq('id', transactionId)
    .eq('ff_user_id', user.id)
    .eq('status', 'draft')   // Solo se puede publicar desde draft

  if (error) return { error: 'Error al publicar la carga' }

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'freight_forwarder',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'transaction.published',
    entityType:     'transaction',
    entityId:       transactionId,
    metadata:       {},
  })

  revalidatePath('/ff/transacciones')
  revalidatePath(`/ff/transacciones/${transactionId}`)
  return {}
}

// ── confirmDeliveryAction ─────────────────────────────────────────────────────
//
// El FF confirma que recibió la carga correctamente.
// Esto es el último paso del ciclo: transacción pasa a 'completed' y los
// payment splits del saldo final se marcan como listos para liberar.
//
// Por qué el FF necesita confirmar (no es automático al 'delivered'):
// Protege al FF ante entregas incorrectas, mercancía dañada o incompleta.
// En Nuvocargo hay una ventana de 48h. Si el FF no disputa, se auto-confirma.
// En el prototipo el FF confirma explícitamente.
//
export async function confirmDeliveryAction(
  transactionId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'freight_forwarder')
    return { error: 'Sin permisos' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Solo se puede confirmar si el carrier ya marcó 'delivered'
  const { error } = await db
    .from('transactions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', transactionId)
    .eq('ff_user_id', user.id)
    .eq('status', 'delivered')

  if (error) return { error: 'Error al confirmar entrega' }

  // Marcar el split del saldo como listo para liberar
  // (el anticipo ya debería haberse liberado en el pickup)
  await db
    .from('payment_splits')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('transaction_id', transactionId)
    .eq('split_label', 'Saldo final 50%')
    .eq('status', 'pending')

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'freight_forwarder',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'transaction.delivery.confirmed',
    entityType:     'transaction',
    entityId:       transactionId,
    metadata:       {},
  })

  revalidatePath('/ff/transacciones')
  revalidatePath(`/ff/transacciones/${transactionId}`)
  revalidatePath('/carrier/pagos')
  return {}
}
