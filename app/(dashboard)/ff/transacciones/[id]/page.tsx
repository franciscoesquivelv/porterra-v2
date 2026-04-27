import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { PublishButton } from './PublishButton'
import { ConfirmDeliveryButton } from './ConfirmDeliveryButton'
import {
  MapPin, Package, Truck, DollarSign, FileText,
  ChevronLeft, CheckCircle, Clock, AlertTriangle,
  Navigation, ShieldCheck, Flag, Users, Send,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  draft:       { label: 'Borrador',    className: 'bg-slate-100 text-slate-500',                  description: 'Publica la carga para que los transportistas puedan aplicar.' },
  published:   { label: 'Publicada',   className: 'bg-violet-100 text-violet-700 border-violet-200', description: 'Carga visible para transportistas. Esperando asignación.' },
  confirmed:   { label: 'Confirmada',  className: 'bg-blue-100 text-blue-700 border-blue-200',    description: 'Transportista asignado. En espera de recogida.' },
  in_transit:  { label: 'En tránsito', className: 'bg-amber-100 text-amber-700 border-amber-200', description: 'La carga está en movimiento.' },
  delivered:   { label: 'Entregada',   className: 'bg-cyan-100 text-cyan-700 border-cyan-200',    description: 'El transportista reporta entrega. Confirma la recepción.' },
  completed:   { label: 'Completada',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200', description: 'Entrega confirmada. Proceso cerrado.' },
  cancelled:   { label: 'Cancelada',   className: 'bg-red-100 text-red-700 border-red-200',       description: '' },
} as const

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; dot: string }> = {
  origin_pickup:             { label: 'Carga recogida',           icon: Package,      color: 'text-slate-600',   dot: 'bg-slate-400' },
  in_transit:                { label: 'En ruta',                  icon: Navigation,   color: 'text-blue-600',    dot: 'bg-blue-400' },
  border_approach:           { label: 'Aproximándose a frontera', icon: MapPin,       color: 'text-amber-600',   dot: 'bg-amber-400' },
  border_crossing_start:     { label: 'Trámite fronterizo',       icon: ShieldCheck,  color: 'text-orange-600',  dot: 'bg-orange-400' },
  border_crossing_complete:  { label: 'Cruce completado',         icon: CheckCircle,  color: 'text-cyan-600',    dot: 'bg-cyan-400' },
  customs_cleared:           { label: 'Aduana despachada',        icon: ShieldCheck,  color: 'text-teal-600',    dot: 'bg-teal-400' },
  in_transit_destination:    { label: 'En ruta al destino',       icon: Navigation,   color: 'text-violet-600',  dot: 'bg-violet-400' },
  delivered:                 { label: 'Entregado',                icon: Flag,         color: 'text-emerald-600', dot: 'bg-emerald-500' },
  incident:                  { label: 'Incidente',                icon: AlertTriangle,color: 'text-red-600',     dot: 'bg-red-500' },
  delay:                     { label: 'Retraso',                  icon: Clock,        color: 'text-amber-600',   dot: 'bg-amber-400' },
}

const PAIS_LABEL: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

interface TrackingEvent {
  id: string
  event_type: string
  country: string | null
  location_name: string | null
  notes: string | null
  created_at: string
}

interface Transaction {
  id: string
  reference_number: string | null
  status: keyof typeof STATUS_CONFIG
  cargo_description: string
  cargo_type: string
  total_amount_usd: number
  porterra_fee_usd: number | null
  carrier_payout_usd: number | null
  origin_country: string
  destination_country: string
  pickup_date: string | null
  delivery_date: string | null
  created_at: string
  carrier_user_id: string | null
}

interface LoadApplication {
  id: string
  carrier_user_id: string
  status: string
  notes: string | null
  created_at: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TransaccionDetallePage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: tx }, { data: events }, { data: duca }, { data: applications }] = await Promise.all([
    db.from('transactions')
      .select('id, reference_number, status, cargo_description, cargo_type, total_amount_usd, porterra_fee_usd, carrier_payout_usd, origin_country, destination_country, pickup_date, delivery_date, created_at, carrier_user_id')
      .eq('id', id)
      .eq('ff_user_id', user.id)
      .single() as Promise<{ data: Transaction | null }>,
    db.from('tracking_events')
      .select('id, event_type, country, location_name, notes, created_at')
      .eq('transaction_id', id)
      .order('created_at', { ascending: true }) as Promise<{ data: TrackingEvent[] | null }>,
    db.from('duca_documents')
      .select('id, status, duca_number, tipo_duca, rejection_reason, created_at')
      .eq('transaction_id', id)
      .eq('ff_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as Promise<{ data: { id: string; status: string; duca_number: string | null; tipo_duca: string; rejection_reason: string | null; created_at: string } | null }>,
    db.from('load_applications')
      .select('id, carrier_user_id, status, notes, created_at')
      .eq('transaction_id', id)
      .order('created_at', { ascending: false }) as Promise<{ data: LoadApplication[] | null }>,
  ])

  if (!tx) notFound()

  const trackingList  = events ?? []
  const appList       = applications ?? []
  const cfg           = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.draft
  const lastEvent     = trackingList[trackingList.length - 1]
  const pendingApps   = appList.filter(a => a.status === 'pending').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={tx.reference_number ?? 'Transacción'}
        subtitle={tx.cargo_description}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Back + acciones */}
        <div className="flex items-center justify-between">
          <Link href="/ff/transacciones" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1A1A2E] transition-colors">
            <ChevronLeft size={15} /> Volver
          </Link>
          <div className="flex items-center gap-2">
            {/* Botón Publicar — solo en estado draft */}
            {tx.status === 'draft' && (
              <PublishButton transactionId={tx.id} />
            )}
            {/* Botón Confirmar entrega — solo cuando el carrier dice que entregó */}
            {tx.status === 'delivered' && (
              <ConfirmDeliveryButton transactionId={tx.id} />
            )}
            {/* Generar DUCA — solo si no tiene y la carga está confirmada o en tránsito */}
            {!duca && ['confirmed', 'in_transit'].includes(tx.status) && (
              <Link href={`/ff/duca/nueva?tx=${tx.id}`} className="inline-flex items-center gap-1.5 text-xs bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white px-3 py-1.5 rounded-lg transition-colors">
                <FileText size={12} /> Generar DUCA-T
              </Link>
            )}
            <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
          </div>
        </div>

        {/* Banner contextual según estado */}
        {cfg.description && (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
            tx.status === 'delivered' ? 'bg-cyan-50 border border-cyan-200 text-cyan-800' :
            tx.status === 'published' ? 'bg-violet-50 border border-violet-200 text-violet-800' :
            'bg-slate-50 border border-slate-200 text-slate-600'
          }`}>
            {tx.status === 'delivered' ? <CheckCircle size={15} className="shrink-0 text-cyan-600" /> :
             tx.status === 'published' ? <Send size={15} className="shrink-0 text-violet-600" /> :
             <Clock size={15} className="shrink-0 text-slate-400" />}
            {cfg.description}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Columna principal */}
          <div className="col-span-2 space-y-5">

            {/* Info básica */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h2 className="text-sm font-semibold text-[#1A1A2E] mb-4">Detalle de la carga</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Ruta', value: `${PAIS_LABEL[tx.origin_country] ?? tx.origin_country} → ${PAIS_LABEL[tx.destination_country] ?? tx.destination_country}`, icon: MapPin },
                  { label: 'Tipo de carga', value: tx.cargo_type, icon: Package },
                  { label: 'Monto total', value: `$${Number(tx.total_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })} USD`, icon: DollarSign },
                  { label: 'Pago al carrier', value: tx.carrier_payout_usd ? `$${Number(tx.carrier_payout_usd).toLocaleString('en', { minimumFractionDigits: 2 })} USD` : '—', icon: Truck },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} className="text-slate-400" />
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#1A1A2E]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Aplicaciones de carriers — visible cuando está published o ya confirmada */}
            {(tx.status === 'published' || (appList.length > 0 && tx.status !== 'draft')) && (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-[#1A1A2E]">Aplicaciones de transportistas</h2>
                  </div>
                  {pendingApps > 0 && (
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                      {pendingApps} pendiente{pendingApps > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {appList.length === 0 ? (
                  <div className="py-10 text-center">
                    <Users size={24} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Ningún transportista ha aplicado aún</p>
                    <p className="text-xs text-slate-300 mt-1">Las aplicaciones aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {appList.map((app) => (
                      <div key={app.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-xs font-mono text-slate-400">{app.carrier_user_id.substring(0, 8)}…</p>
                          {app.notes && <p className="text-xs text-slate-500 mt-0.5 italic">"{app.notes}"</p>}
                          <p className="text-[10px] text-slate-300 mt-0.5">
                            {new Date(app.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-xs ${
                          app.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          app.status === 'rejected' ? 'bg-slate-100 text-slate-400' :
                          'bg-violet-50 text-violet-700 border-violet-200'
                        }`}>
                          {app.status === 'accepted' ? 'Asignado' : app.status === 'rejected' ? 'No seleccionado' : 'Pendiente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {tx.status === 'published' && appList.length > 0 && (
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-400">El equipo PORTERRA asignará al transportista. Recibirás una notificación.</p>
                  </div>
                )}
              </div>
            )}

            {/* Timeline de tracking */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1A1A2E]">Timeline de tracking</h2>
                <span className="text-xs text-slate-400">{trackingList.length} evento{trackingList.length !== 1 ? 's' : ''}</span>
              </div>

              {trackingList.length === 0 ? (
                <div className="py-12 text-center">
                  <Navigation size={28} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin eventos de tracking aún</p>
                  <p className="text-xs text-slate-300 mt-1">El transportista actualizará el estado desde su cuenta</p>
                </div>
              ) : (
                <div className="p-5">
                  <div className="relative">
                    <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-slate-100" />
                    <div className="space-y-4">
                      {trackingList.map((event, i) => {
                        const evtCfg = EVENT_CONFIG[event.event_type] ?? { label: event.event_type, icon: MapPin, color: 'text-slate-500', dot: 'bg-slate-400' }
                        const Icon = evtCfg.icon
                        const isLast = i === trackingList.length - 1
                        return (
                          <div key={event.id} className="relative flex gap-4 pl-8">
                            <div className={`absolute left-0 top-1 w-7 h-7 rounded-full ${isLast ? evtCfg.dot : 'bg-slate-200'} flex items-center justify-center shadow-sm z-10`}>
                              <Icon size={13} className={isLast ? 'text-white' : 'text-slate-400'} />
                            </div>
                            <div className="flex-1 pb-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className={`text-sm font-semibold ${isLast ? evtCfg.color : 'text-slate-600'}`}>{evtCfg.label}</p>
                                  {(event.location_name || event.country) && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      {event.location_name}{event.location_name && event.country ? ' · ' : ''}{event.country ? PAIS_LABEL[event.country] ?? event.country : ''}
                                    </p>
                                  )}
                                  {event.notes && (
                                    <p className="text-xs text-slate-500 mt-1 italic">"{event.notes}"</p>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                                  {new Date(event.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar derecho */}
          <div className="space-y-4">

            {/* Estado actual */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Estado actual</h3>
              {lastEvent ? (
                <div>
                  {(() => {
                    const evtCfg = EVENT_CONFIG[lastEvent.event_type]
                    const Icon = evtCfg?.icon ?? MapPin
                    return (
                      <div className={`flex items-center gap-2 ${evtCfg?.color ?? 'text-slate-600'}`}>
                        <Icon size={16} />
                        <span className="text-sm font-semibold">{evtCfg?.label ?? lastEvent.event_type}</span>
                      </div>
                    )
                  })()}
                  {lastEvent.location_name && (
                    <p className="text-xs text-slate-400 mt-1.5">{lastEvent.location_name}</p>
                  )}
                  <p className="text-[10px] text-slate-300 mt-1">
                    {new Date(lastEvent.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Sin actualizaciones</p>
              )}
            </div>

            {/* DUCA */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">DUCA-T</h3>
              {duca ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-[#06B6D4]" />
                    <span className="text-xs font-medium text-slate-700">{duca.duca_number ?? 'Borrador'}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs ${
                    duca.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    duca.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    duca.status === 'rejected'  ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {duca.status === 'approved' ? 'Aprobada' :
                     duca.status === 'submitted' ? 'En revisión SAT/DGA' :
                     duca.status === 'rejected'  ? 'Rechazada' : 'Borrador'}
                  </Badge>
                  {duca.status === 'rejected' && (
                    <div className="mt-2 p-2 bg-red-50 rounded-lg">
                      <p className="text-[10px] text-red-600 font-medium">Motivo del rechazo:</p>
                      <p className="text-xs text-red-700 mt-0.5">{(duca as { rejection_reason?: string }).rejection_reason ?? '—'}</p>
                    </div>
                  )}
                  {duca.status === 'rejected' && (
                    <Link href={`/ff/duca/nueva?duca=${duca.id}&tx=${tx.id}`} className="inline-flex items-center gap-1 text-xs text-[#06B6D4] hover:underline mt-2">
                      <FileText size={11} /> Corregir y reenviar
                    </Link>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Sin DUCA generada</p>
                  {['confirmed', 'in_transit', 'draft', 'published'].includes(tx.status) && (
                    <Link href={`/ff/duca/nueva?tx=${tx.id}`} className="inline-flex items-center gap-1 text-xs text-[#06B6D4] hover:underline">
                      <FileText size={11} /> Generar DUCA-T
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Fechas */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Fechas</h3>
              <div className="space-y-2">
                {[
                  { label: 'Creada', value: tx.created_at },
                  { label: 'Recogida', value: tx.pickup_date },
                  { label: 'Entrega est.', value: tx.delivery_date },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className="text-xs font-medium text-slate-600">
                      {value ? new Date(value).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
