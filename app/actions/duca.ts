'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface DucaFormData {
  transaction_id?: string
  // Paso 1
  pais_procedencia?: string
  aduana_inicio?: string
  deposito_origen?: string
  lugar_embarque?: string
  pais_destino?: string
  aduana_destino?: string
  deposito_destino?: string
  lugar_desembarque?: string
  observaciones?: string
  // Paso 2 — Exportador
  exportador_nombre?: string
  exportador_domicilio?: string
  exportador_tipo_doc?: string
  exportador_numero_doc?: string
  exportador_pais_emision?: string
  // Paso 3 — Importador
  importador_nombre?: string
  importador_domicilio?: string
  importador_tipo_doc?: string
  importador_numero_doc?: string
  importador_pais_emision?: string
  // Paso 4 — Ruta de tránsito
  ruta_transito?: { pais: string; aduana: string }[]
  // Paso 5 — Transportista y vehículo
  transportista_codigo?: string
  transportista_nombre?: string
  transportista_email?: string
  vehiculo_marca?: string
  vehiculo_modelo?: string
  vehiculo_vin?: string
  vehiculo_motor?: string
  vehiculo_pais_registro?: string
  vehiculo_placa?: string
  // Paso 6 — Conductor
  conductor_primer_nombre?: string
  conductor_segundo_nombre?: string
  conductor_primer_apellido?: string
  conductor_segundo_apellido?: string
  conductor_tipo_doc?: string
  conductor_numero_doc?: string
  conductor_licencia?: string
  conductor_pais_exp?: string
  // Paso 7 — Mercancías
  mercancias?: MercanciaItem[]
  valor_transaccion?: number
  gastos_transporte?: number
  gastos_seguro?: number
  otros_gastos?: number
}

export interface MercanciaItem {
  codigo_sac: string
  descripcion: string
  cantidad_bultos: number
  clase_bultos: string
  pais_origen: string
  marca?: string
  peso_bruto_kg: number
}

// ── Guardar borrador DUCA ────────────────────────────────────────────────────

export async function saveDucaDraftAction(
  data: DucaFormData,
  ducaId?: string,
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'freight_forwarder')
    return { error: 'Solo los Freight Forwarders pueden generar DUCAs' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const payload = {
    ff_user_id:                user.id,
    tipo_duca:                 'DUCA-T',
    transaction_id:            data.transaction_id ?? null,
    pais_procedencia:          data.pais_procedencia ?? null,
    aduana_inicio:             data.aduana_inicio ?? null,
    deposito_origen:           data.deposito_origen ?? null,
    lugar_embarque:            data.lugar_embarque ?? null,
    pais_destino:              data.pais_destino ?? null,
    aduana_destino:            data.aduana_destino ?? null,
    deposito_destino:          data.deposito_destino ?? null,
    lugar_desembarque:         data.lugar_desembarque ?? null,
    observaciones:             data.observaciones ?? null,
    exportador_nombre:         data.exportador_nombre ?? null,
    exportador_domicilio:      data.exportador_domicilio ?? null,
    exportador_tipo_doc:       data.exportador_tipo_doc ?? null,
    exportador_numero_doc:     data.exportador_numero_doc ?? null,
    exportador_pais_emision:   data.exportador_pais_emision ?? null,
    importador_nombre:         data.importador_nombre ?? null,
    importador_domicilio:      data.importador_domicilio ?? null,
    importador_tipo_doc:       data.importador_tipo_doc ?? null,
    importador_numero_doc:     data.importador_numero_doc ?? null,
    importador_pais_emision:   data.importador_pais_emision ?? null,
    ruta_transito:             data.ruta_transito ?? [],
    transportista_codigo:      data.transportista_codigo ?? null,
    transportista_nombre:      data.transportista_nombre ?? null,
    transportista_email:       data.transportista_email ?? null,
    vehiculo_marca:            data.vehiculo_marca ?? null,
    vehiculo_modelo:           data.vehiculo_modelo ?? null,
    vehiculo_vin:              data.vehiculo_vin ?? null,
    vehiculo_motor:            data.vehiculo_motor ?? null,
    vehiculo_pais_registro:    data.vehiculo_pais_registro ?? null,
    vehiculo_placa:            data.vehiculo_placa ?? null,
    conductor_primer_nombre:   data.conductor_primer_nombre ?? null,
    conductor_segundo_nombre:  data.conductor_segundo_nombre ?? null,
    conductor_primer_apellido: data.conductor_primer_apellido ?? null,
    conductor_segundo_apellido:data.conductor_segundo_apellido ?? null,
    conductor_tipo_doc:        data.conductor_tipo_doc ?? null,
    conductor_numero_doc:      data.conductor_numero_doc ?? null,
    conductor_licencia:        data.conductor_licencia ?? null,
    conductor_pais_exp:        data.conductor_pais_exp ?? null,
    mercancias:                data.mercancias ?? [],
    valor_transaccion:         data.valor_transaccion ?? null,
    gastos_transporte:         data.gastos_transporte ?? null,
    gastos_seguro:             data.gastos_seguro ?? null,
    otros_gastos:              data.otros_gastos ?? null,
    status:                    'draft',
  }

  let id = ducaId
  if (ducaId) {
    const { error } = await db.from('duca_documents').update(payload).eq('id', ducaId).eq('ff_user_id', user.id)
    if (error) return { error: 'Error al guardar borrador' }
  } else {
    const { data: row, error } = await db.from('duca_documents').insert(payload).select('id').single()
    if (error) return { error: 'Error al crear DUCA' }
    id = row.id
  }

  revalidatePath('/ff/duca')
  return { id }
}

// ── Enviar DUCA para revisión ─────────────────────────────────────────────────

export async function submitDucaAction(ducaId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? 'unknown'
  const ua = headersList.get('user-agent') ?? 'unknown'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db
    .from('duca_documents')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', ducaId)
    .eq('ff_user_id', user.id)
    .eq('status', 'draft')

  if (error) return { error: 'Error al enviar DUCA' }

  await logAuditEvent({
    actorUserId: user.id, actorRole: 'freight_forwarder',
    actorIp: ip, actorUserAgent: ua,
    eventType: 'document.duca.generated',
    entityType: 'duca_document', entityId: ducaId,
    metadata: { action: 'submitted' },
  })

  revalidatePath('/ff/duca')
  return {}
}

// ── approveDucaAction (SAT/DGA simulado) ─────────────────────────────────────
//
// El admin actúa como el sistema SAT/DGA externo y aprueba una DUCA enviada.
// Al hacer update a status='approved', el trigger de DB genera el duca_number
// automáticamente (DUCA-T-YYYY-NNNNN).
//
// Por qué esto está en PORTERRA y no en un sistema externo:
// En producción, PORTERRA conectaría con la API del SIECA/TICA vía webservices.
// El prototipo simula ese flujo en una sección administrativa separada,
// claramente marcada como "SAT/DGA", para que sea evidente en el demo que
// es un sistema externo siendo simulado.
//
export async function approveDucaAction(ducaId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin')
    return { error: 'Solo el administrador puede aprobar DUCAs (simulando SAT/DGA)' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Aprobar la DUCA — el trigger genera el duca_number
  const { data: updated, error } = await db
    .from('duca_documents')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', ducaId)
    .eq('status', 'submitted')
    .select('id, duca_number, transaction_id')
    .single()

  if (error || !updated) return { error: 'Error al aprobar DUCA o ya fue procesada' }

  // Sincronizar en la transacción para visibilidad del FF
  if (updated.transaction_id) {
    await db
      .from('transactions')
      .update({
        duca_status: 'approved',
        duca_number: updated.duca_number,
      })
      .eq('id', updated.transaction_id)
  }

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'admin',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'document.duca.approved',
    entityType:     'duca_document',
    entityId:       ducaId,
    metadata:       { duca_number: updated.duca_number, simulated_authority: 'SAT/DGA' },
  })

  revalidatePath('/admin/sat-dga')
  revalidatePath('/ff/duca')
  return {}
}

// ── rejectDucaAction (SAT/DGA simulado) ──────────────────────────────────────
//
// El admin (simulando SAT/DGA) rechaza la DUCA con una razón específica.
// El FF recibe la razón para corregir y reenviar.
//
export async function rejectDucaAction(
  ducaId: string,
  reason: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'admin')
    return { error: 'Solo el administrador puede rechazar DUCAs (simulando SAT/DGA)' }
  if (!reason.trim()) return { error: 'Debes indicar el motivo del rechazo' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: updated, error } = await db
    .from('duca_documents')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', ducaId)
    .eq('status', 'submitted')
    .select('id, transaction_id')
    .single()

  if (error || !updated) return { error: 'Error al rechazar DUCA o ya fue procesada' }

  if (updated.transaction_id) {
    await db
      .from('transactions')
      .update({ duca_status: 'rejected' })
      .eq('id', updated.transaction_id)
  }

  const headersList = await headers()
  await logAuditEvent({
    actorUserId:    user.id,
    actorRole:      'admin',
    actorIp:        headersList.get('x-forwarded-for') ?? 'unknown',
    actorUserAgent: headersList.get('user-agent') ?? 'unknown',
    eventType:      'document.duca.rejected',
    entityType:     'duca_document',
    entityId:       ducaId,
    metadata:       { reason, simulated_authority: 'SAT/DGA' },
  })

  revalidatePath('/admin/sat-dga')
  revalidatePath('/ff/duca')
  return {}
}

// ── Agregar evento de tracking (carrier) ─────────────────────────────────────

export async function addTrackingEventAction(
  transactionId: string,
  eventType: string,
  locationName: string,
  country: string,
  notes: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  if (user.app_metadata?.porterra_role !== 'carrier')
    return { error: 'Solo los transportistas pueden actualizar el estado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Verificar que la transacción le pertenece
  const { data: tx } = await db
    .from('transactions')
    .select('id, status')
    .eq('id', transactionId)
    .eq('carrier_user_id', user.id)
    .single()

  if (!tx) return { error: 'Transacción no encontrada o sin permisos' }

  const { error } = await db.from('tracking_events').insert({
    transaction_id: transactionId,
    event_type:     eventType,
    country:        country || null,
    location_name:  locationName || null,
    notes:          notes || null,
    created_by:     user.id,
  })

  if (error) return { error: 'Error al registrar evento' }

  // Si el evento es 'delivered', marcar la transacción como 'delivered'
  // (NO 'completed' — eso requiere confirmación del FF)
  // El carrier dice "entregué", el FF confirma. Hasta que el FF confirme,
  // el status es 'delivered' y el saldo final no se libera.
  if (eventType === 'delivered') {
    await db
      .from('transactions')
      .update({ status: 'delivered' })
      .eq('id', transactionId)
      .eq('carrier_user_id', user.id)
  }

  // Si es 'origin_pickup' o 'border_crossing_start', actualizar status a in_transit
  if (eventType === 'origin_pickup' || eventType === 'in_transit') {
    await db
      .from('transactions')
      .update({ status: 'in_transit' })
      .eq('id', transactionId)
      .eq('carrier_user_id', user.id)
      .eq('status', 'confirmed')
  }

  revalidatePath('/carrier/cargas')
  revalidatePath(`/ff/transacciones/${transactionId}`)
  revalidatePath('/admin/financiero')
  return {}
}
