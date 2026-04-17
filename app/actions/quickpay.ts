'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const QUICKPAY_RATE = 3.00  // 3% de descuento

export async function requestQuickPayAction(
  splitId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verificar que el split pertenece al carrier y está pendiente
  const { data: split } = await db
    .from('payment_splits')
    .select('id, amount_usd, status, carrier_user_id')
    .eq('id', splitId)
    .eq('carrier_user_id', user.id)
    .single() as { data: { id: string; amount_usd: number; status: string; carrier_user_id: string } | null }

  if (!split)               return { error: 'Pago no encontrado' }
  if (split.status !== 'pending') return { error: 'Este pago no está disponible para QuickPay' }

  const gross  = Number(split.amount_usd)
  const fee    = Math.round(gross * QUICKPAY_RATE) / 100
  const net    = gross - fee

  // Crear solicitud QuickPay
  const { error: insertError } = await db
    .from('quickpay_requests')
    .insert({
      split_id:        splitId,
      carrier_user_id: user.id,
      gross_amount_usd: gross,
      discount_rate:   QUICKPAY_RATE,
      fee_usd:         fee,
      net_amount_usd:  net,
    })

  if (insertError) {
    if (insertError.code === '23505') return { error: 'Ya tienes una solicitud activa para este pago' }
    return { error: 'Error al crear la solicitud' }
  }

  // Marcar el split como processing para que no se pueda solicitar dos veces
  await db
    .from('payment_splits')
    .update({ status: 'processing' })
    .eq('id', splitId)

  revalidatePath('/carrier/factoraje')
  revalidatePath('/admin/factoring')
  return {}
}

export async function disburseQuickPayAction(
  requestId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin') return { error: 'Sin permisos' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any

  // Obtener la solicitud
  const { data: req } = await admin
    .from('quickpay_requests')
    .select('id, split_id, status')
    .eq('id', requestId)
    .single() as { data: { id: string; split_id: string; status: string } | null }

  if (!req)                    return { error: 'Solicitud no encontrada' }
  if (req.status !== 'pending') return { error: 'Esta solicitud ya fue procesada' }

  // Marcar QuickPay como desembolsado
  const { error } = await admin
    .from('quickpay_requests')
    .update({ status: 'disbursed', disbursed_at: new Date().toISOString(), disbursed_by: user.id })
    .eq('id', requestId)

  if (error) return { error: 'Error al desembolsar' }

  // Marcar el split como pagado
  await admin
    .from('payment_splits')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: 'porterra_wallet' })
    .eq('id', req.split_id)

  revalidatePath('/carrier/factoraje')
  revalidatePath('/carrier/pagos')
  revalidatePath('/admin/factoring')
  return {}
}

export async function rejectQuickPayAction(
  requestId: string,
  notes: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin') return { error: 'Sin permisos' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any

  const { data: req } = await admin
    .from('quickpay_requests')
    .select('id, split_id')
    .eq('id', requestId)
    .single() as { data: { id: string; split_id: string } | null }

  if (!req) return { error: 'Solicitud no encontrada' }

  await admin
    .from('quickpay_requests')
    .update({ status: 'rejected', notes })
    .eq('id', requestId)

  // Devolver el split a 'pending'
  await admin
    .from('payment_splits')
    .update({ status: 'pending' })
    .eq('id', req.split_id)

  revalidatePath('/carrier/factoraje')
  revalidatePath('/admin/factoring')
  return {}
}
