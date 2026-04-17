import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, Truck, CheckCircle, Clock } from 'lucide-react'
import { TrackingUpdate } from './TrackingUpdate'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  draft:       { label: 'Borrador',    className: 'bg-slate-100 text-slate-500' },
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
  oversized:    'Sobredimensionado',
  liquid:       'Líquido',
  livestock:    'Ganado',
}

interface Transaction {
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

export default async function CarrierCargasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: txs } = await db
    .from('transactions')
    .select('id, reference_number, cargo_description, cargo_type, status, origin_country, destination_country, carrier_payout_usd, pickup_date, delivery_date, created_at')
    .eq('carrier_user_id', user.id)
    .order('created_at', { ascending: false }) as { data: Transaction[] | null }

  const all       = txs ?? []
  const active    = all.filter(t => ['confirmed', 'in_transit'].includes(t.status))
  const completed = all.filter(t => t.status === 'completed')
  const totalEarned = completed.reduce((s, t) => s + Number(t.carrier_payout_usd ?? 0), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Mis cargas" subtitle={`${all.length} carga${all.length !== 1 ? 's' : ''} asignadas`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Activas',        value: active.length.toString(),                                                              suffix: '',    icon: Truck,       color: 'text-[#06B6D4]',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Completadas',    value: completed.length.toString(),                                                           suffix: '',    icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Total generado', value: `$${totalEarned.toLocaleString('en', { minimumFractionDigits: 2 })}`,                  suffix: 'USD', icon: Package,     color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
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

        {/* Tabla */}
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
              {all.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">No tienes cargas asignadas aún</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                all.map((tx) => {
                  const cfg = STATUS_CONFIG[tx.status]
                  return (
                    <TableRow key={tx.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <p className="text-xs font-mono text-slate-400">{tx.reference_number ?? '—'}</p>
                        <p className="text-sm font-medium text-[#1A1A2E] mt-0.5 max-w-[180px] truncate">{tx.cargo_description}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {tx.origin_country} → {tx.destination_country}
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
                        {tx.status !== 'completed' && tx.status !== 'cancelled' && (
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
      </div>
    </div>
  )
}
