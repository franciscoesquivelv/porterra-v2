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
