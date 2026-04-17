import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, Truck, CheckCircle, Clock, MapPin, DollarSign } from 'lucide-react'
import { TrackingUpdate } from './TrackingUpdate'
import { ApplyButton } from './ApplyButton'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  draft:       { label: 'Borrador',    className: 'bg-slate-100 text-slate-500' },
  published:   { label: 'Disponible',  className: 'bg-violet-100 text-violet-700 border-violet-200' },
  confirmed:   { label: 'Confirmada',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  in_transit:  { label: 'En tránsito', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  delivered:   { label: 'Entregada',   className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  completed:   { label: 'Completada',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:   { label: 'Cancelada',   className: 'bg-red-100 text-red-700 border-red-200' },
} as const

const CARGO_TYPE_LABEL: Record<string, string> = {
  general:      'General',
  refrigerated: 'Refrigerado',
  hazmat:       'Peligroso',
  dangerous:    'Peligroso',
  oversized:    'Sobredimensionado',
  liquid:       'Líquido',
  livestock:    'Ganado',
}

const PAIS: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

interface AssignedTransaction {
  id: string
  reference_number: string | null
  cargo_description: string
  cargo_type: string
  status: keyof typeof STATUS_CONFIG
  origin_country: string
  destination_country: string
  carrier_payout_usd: number | null
  pickup_date: string | null
  delivery_date: string | null
  created_at: string
}

interface AvailableLoad {
  id: string
  reference_number: string | null
  cargo_description: string
  cargo_type: string
  origin_country: string
  destination_country: string
  carrier_payout_usd: number | null
  cargo_weight_kg: number | null
  pickup_date: string | null
  delivery_date: string | null
  created_at: string
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function CarrierCargasPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams
  const activeTab = tab === 'asignadas' ? 'asignadas' : 'disponibles'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: assigned }, { data: available }, { data: myApplications }] = await Promise.all([
    // Cargas asignadas a este carrier
    db.from('transactions')
      .select('id, reference_number, cargo_description, cargo_type, status, origin_country, destination_country, carrier_payout_usd, pickup_date, delivery_date, created_at')
      .eq('carrier_user_id', user.id)
      .order('created_at', { ascending: false }) as Promise<{ data: AssignedTransaction[] | null }>,

    // Cargas publicadas sin carrier asignado (el marketplace)
    db.from('transactions')
      .select('id, reference_number, cargo_description, cargo_type, origin_country, destination_country, carrier_payout_usd, cargo_weight_kg, pickup_date, delivery_date, created_at')
      .eq('status', 'published')
      .is('carrier_user_id', null)
      .order('created_at', { ascending: false }) as Promise<{ data: AvailableLoad[] | null }>,

    // Aplicaciones de este carrier (para saber si ya aplicó)
    db.from('load_applications')
      .select('transaction_id, status')
      .eq('carrier_user_id', user.id) as Promise<{ data: Array<{ transaction_id: string; status: string }> | null }>,
  ])

  const assignedList = assigned ?? []
  const availableList = available ?? []
  const appliedTxIds = new Set((myApplications ?? []).map(a => a.transaction_id))
  const applicationMap = Object.fromEntries((myApplications ?? []).map(a => [a.transaction_id, a.status]))

  const active    = assignedList.filter(t => ['confirmed', 'in_transit'].includes(t.status))
  const completed = assignedList.filter(t => t.status === 'completed')
  const totalEarned = completed.reduce((s, t) => s + Number(t.carrier_payout_usd ?? 0), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Cargas"
        subtitle={`${availableList.length} disponible${availableList.length !== 1 ? 's' : ''} · ${assignedList.length} asignada${assignedList.length !== 1 ? 's' : ''}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Disponibles',    value: availableList.length.toString(), suffix: '',    icon: Package,     color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
            { label: 'Activas',        value: active.length.toString(),        suffix: '',    icon: Truck,       color: 'text-[#06B6D4]',   bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Total ganado',   value: `$${totalEarned.toLocaleString('en', { minimumFractionDigits: 2 })}`, suffix: 'USD', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          ].map(({ label, value, suffix, icon: Icon, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-4`}>
              <Icon size={20} className={`${color} shrink-0`} />
              <div>
                <p className="text-xl font-bold text-[#1A1A2E]">{value} <span className="text-xs font-normal text-slate-400">{suffix}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {[
            { key: 'disponibles', label: 'Disponibles', count: availableList.length },
            { key: 'asignadas',   label: 'Mis cargas',  count: assignedList.length },
          ].map(({ key, label, count }) => (
            <Link
              key={key}
              href={key === 'disponibles' ? '/carrier/cargas' : '/carrier/cargas?tab=asignadas'}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                activeTab === key
                  ? 'bg-white text-[#1A1A2E] shadow-sm'
                  : 'text-slate-500 hover:text-[#1A1A2E]'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  activeTab === key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* ── TAB: DISPONIBLES ──────────────────────────────────────────── */}
        {activeTab === 'disponibles' && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {availableList.length === 0 ? (
              <div className="py-20 text-center">
                <Package size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No hay cargas disponibles en este momento</p>
                <p className="text-xs text-slate-300 mt-1">Las nuevas cargas publicadas por los FFs aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {availableList.map((load) => {
                  const appStatus = applicationMap[load.id]
                  const alreadyApplied = appliedTxIds.has(load.id)
                  return (
                    <div key={load.id} className="p-5 hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-mono text-slate-400">{load.reference_number ?? '—'}</p>
                            <span className="text-xs text-slate-300">·</span>
                            <span className="text-xs text-slate-400">{CARGO_TYPE_LABEL[load.cargo_type] ?? load.cargo_type}</span>
                            {load.cargo_weight_kg && (
                              <>
                                <span className="text-xs text-slate-300">·</span>
                                <span className="text-xs text-slate-400">{Number(load.cargo_weight_kg).toLocaleString('en')} kg</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-[#1A1A2E] truncate mb-2">{load.cargo_description}</p>

                          {/* Ruta visual */}
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400" />
                              <span className="font-medium">{PAIS[load.origin_country] ?? load.origin_country}</span>
                            </div>
                            <div className="flex-1 h-px bg-slate-200 relative mx-1">
                              <Truck size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-400 bg-white" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{PAIS[load.destination_country] ?? load.destination_country}</span>
                            </div>
                          </div>

                          {/* Fechas */}
                          {(load.pickup_date || load.delivery_date) && (
                            <div className="flex items-center gap-4 mt-2">
                              {load.pickup_date && (
                                <div className="flex items-center gap-1">
                                  <Clock size={10} className="text-slate-400" />
                                  <span className="text-xs text-slate-400">
                                    Recogida {new Date(load.pickup_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                              )}
                              {load.delivery_date && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle size={10} className="text-slate-400" />
                                  <span className="text-xs text-slate-400">
                                    Entrega {new Date(load.delivery_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Pago + acción */}
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <DollarSign size={14} className="text-emerald-600" />
                              <span className="text-lg font-bold text-emerald-700">
                                {load.carrier_payout_usd
                                  ? `$${Number(load.carrier_payout_usd).toLocaleString('en', { minimumFractionDigits: 2 })}`
                                  : '—'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">USD · Pago al carrier</p>
                          </div>

                          {alreadyApplied ? (
                            <div className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                              appStatus === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                              appStatus === 'rejected' ? 'bg-slate-100 text-slate-500' :
                              'bg-violet-100 text-violet-700'
                            }`}>
                              {appStatus === 'accepted' ? '✓ Asignado' :
                               appStatus === 'rejected' ? 'No seleccionado' :
                               '⏳ Aplicación enviada'}
                            </div>
                          ) : (
                            <ApplyButton transactionId={load.id} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: MIS CARGAS ───────────────────────────────────────────── */}
        {activeTab === 'asignadas' && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-xs font-semibold text-slate-500">Carga</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Ruta</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Pago</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Fechas</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Tracking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Package size={32} className="text-slate-300" />
                        <p className="text-sm text-slate-400">No tienes cargas asignadas aún</p>
                        <Link href="/carrier/cargas" className="text-xs text-[#06B6D4] hover:underline">Ver cargas disponibles</Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  assignedList.map((tx) => {
                    const cfg = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.draft
                    return (
                      <TableRow key={tx.id} className="hover:bg-slate-50/40">
                        <TableCell className="py-3">
                          <p className="text-xs font-mono text-slate-400">{tx.reference_number ?? '—'}</p>
                          <p className="text-sm font-medium text-[#1A1A2E] mt-0.5 max-w-[180px] truncate">{tx.cargo_description}</p>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                          {PAIS[tx.origin_country] ?? tx.origin_country} → {PAIS[tx.destination_country] ?? tx.destination_country}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500">{CARGO_TYPE_LABEL[tx.cargo_type] ?? tx.cargo_type}</span>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-emerald-700">
                          {tx.carrier_payout_usd
                            ? `$${Number(tx.carrier_payout_usd).toLocaleString('en', { minimumFractionDigits: 2 })}`
                            : <span className="text-slate-300">—</span>}
                        </TableCell>
                        <TableCell>
                          {tx.pickup_date || tx.delivery_date ? (
                            <div className="space-y-0.5">
                              {tx.pickup_date && (
                                <div className="flex items-center gap-1">
                                  <Clock size={10} className="text-slate-400 shrink-0" />
                                  <span className="text-xs text-slate-400">
                                    {new Date(tx.pickup_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                              )}
                              {tx.delivery_date && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle size={10} className="text-slate-400 shrink-0" />
                                  <span className="text-xs text-slate-400">
                                    {new Date(tx.delivery_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {!['completed', 'cancelled', 'delivered'].includes(tx.status) && (
                            <TrackingUpdate transactionId={tx.id} referenceNumber={tx.reference_number} />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
