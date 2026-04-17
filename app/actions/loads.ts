'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

// ── applyToLoadAction ─────────────────────────────────────────────────────────
//
// El carrier ve una carga publicada y se postula.
// Por qué no asignamos directamente: PORTERRA actúa como "dispatcher" que
// valida al carrier antes de asignarlo (score, ruta, historial). En Nuvocargo
// esto era manual en las primeras etapas. Eventualmente se puede automatizar
// con reglas: si score > 700 y la ruta matchea, auto-asignar.
//
export async function applyToLoadAction(
  transactionId: string,
  notes?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'carrier')
    return { error: 'Solo los transportistas pueden aplicar a cargas' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verificar que la transacción está publicada y sin carrier asignado
  const { data: tx } = await db
    .from('transactions')
    .select('id, status, carrier_user_id, origin_country, destination_country, carrier_payout_usd')
    .eq('id', transactionId)
    .eq('status', 'published')
    .single()

  if (!tx) return { error: 'Esta carga no está disponible' }
  if (tx.carrier_user_id) return { error: 'Esta carga ya tiene un transportista asignado' }

  // Insertar aplicación (UNIQUE constraint previene duplicados)
  const { error } = await db.from('load_applications').insert({
    transaction_id:  transactionId,
    carrier_user_id: user.id,
    status:          'pending',
    notes:           notes || null,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Ya aplicaste a esta carga' }
    return { error: 'Error al enviar aplicación' }
  }

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'carrier',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'load.application.created',
    entityType:     'transaction',
    entityId:       transactionId,
    metadata:       { notes },
  })

  revalidatePath('/carrier/cargas')
  return {}
}

// ── assignCarrierAction ───────────────────────────────────────────────────────
//
// Admin acepta una aplicación y asigna el carrier a la transacción.
//
// Lo que hace internamente (por qué todo junto en una sola acción):
// 1. Asigna carrier_user_id en la transacción
// 2. Cambia status de la transacción a 'confirmed'
// 3. Marca la aplicación aceptada como 'accepted'
// 4. Rechaza automáticamente el resto de aplicaciones de esa carga
// 5. Crea los payment_splits (anticipo 50% + saldo 50%)
//
// Los pasos 3-5 deben ser atómicos — si alguno falla, el estado queda
// inconsistente. En producción esto sería una transacción PostgreSQL o una
// Supabase Edge Function. Para el prototipo, lo hacemos secuencial y si
// falla en un paso intermedio el admin puede reintentar.
//
export async function assignCarrierAction(
  transactionId: string,
  applicationId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin')
    return { error: 'Solo el administrador puede asignar carriers' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Cargar la aplicación aceptada y la transacción
  const { data: app } = await db
    .from('load_applications')
    .select('id, carrier_user_id, transaction_id')
    .eq('id', applicationId)
    .eq('status', 'pending')
    .single()

  if (!app) return { error: 'Aplicación no encontrada' }

  const { data: tx } = await db
    .from('transactions')
    .select('id, status, carrier_payout_usd, pickup_date, delivery_date')
    .eq('id', transactionId)
    .eq('status', 'published')
    .single()

  if (!tx) return { error: 'Transacción no disponible para asignación' }

  // 1. Asignar carrier y confirmar transacción
  const { error: txErr } = await db
    .from('transactions')
    .update({ carrier_user_id: app.carrier_user_id, status: 'confirmed' })
    .eq('id', transactionId)

  if (txErr) return { error: 'Error al asignar transportista' }

  // 2. Marcar la aplicación ganadora como 'accepted'
  await db
    .from('load_applications')
    .update({ status: 'accepted', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq('id', applicationId)

  // 3. Rechazar el resto de aplicaciones de esta carga
  await db
    .from('load_applications')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq('transaction_id', transactionId)
    .neq('id', applicationId)

  // 4. Crear payment splits
  // Por qué 50/50 y no otro split:
  // El anticipo cubre el costo operativo del viaje (diesel, peajes, viáticos).
  // El saldo final es la ganancia y el incentivo para entregar correctamente.
  // En Nuvocargo usan estructuras similares. El FF paga al completarse la entrega.
  const payout      = Number(tx.carrier_payout_usd ?? 0)
  const anticipo    = Math.round(payout * 0.50 * 100) / 100
  const saldo       = Math.round((payout - anticipo) * 100) / 100
  const pickupDue   = tx.pickup_date ?? null
  const deliveryDue = tx.delivery_date ?? null

  await db.from('payment_splits').insert([
    {
      transaction_id:   transactionId,
      carrier_user_id:  app.carrier_user_id,
      split_label:      'Anticipo 50%',
      amount_usd:       anticipo,
      split_percentage: 50,
      status:           'pending',
      due_date:         pickupDue,
      payment_method:   'bank_transfer',
    },
    {
      transaction_id:   transactionId,
      carrier_user_id:  app.carrier_user_id,
      split_label:      'Saldo final 50%',
      amount_usd:       saldo,
      split_percentage: 50,
      status:           'pending',
      due_date:         deliveryDue,
      payment_method:   'bank_transfer',
    },
  ])

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'admin',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'load.carrier.assigned',
    entityType:     'transaction',
    entityId:       transactionId,
    metadata:       { carrierId: app.carrier_user_id, applicationId, payout },
  })

  revalidatePath('/admin/cargas')
  revalidatePath('/carrier/cargas')
  revalidatePath(`/ff/transacciones/${transactionId}`)
  return {}
}

// ── releasePaymentAction ──────────────────────────────────────────────────────
//
// Admin libera un payment split al carrier.
// En producción esto dispararía una transferencia bancaria real.
// Para el prototipo, cambia el status a 'released' y registra el timestamp.
//
export async function releasePaymentAction(
  splitId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin')
    return { error: 'Solo el administrador puede liberar pagos' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { error } = await db
    .from('payment_splits')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('id', splitId)
    .eq('status', 'pending')

  if (error) return { error: 'Error al liberar pago' }

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'admin',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'payment.split.released',
    entityType:     'payment_split',
    entityId:       splitId,
    metadata:       {},
  })

  revalidatePath('/admin/financiero')
  revalidatePath('/carrier/pagos')
  return {}
}
