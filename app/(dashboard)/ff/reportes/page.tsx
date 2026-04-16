import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { BarChart3, TrendingUp, Package, DollarSign, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface TxRow {
  id: string
  status: string
  total_amount_usd: number
  porterra_fee_usd: number | null
  carrier_payout_usd: number | null
  origin_country: string
  destination_country: string
  cargo_type: string
  created_at: string
}

const COUNTRY_LABEL: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

const CARGO_LABEL: Record<string, string> = {
  general: 'General', refrigerated: 'Refrigerado', hazmat: 'Peligroso',
  oversized: 'Sobredimensionado', liquid: 'Líquido', livestock: 'Ganado',
}

export default async function FfReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: txs } = await db
    .from('transactions')
    .select('id, status, total_amount_usd, porterra_fee_usd, carrier_payout_usd, origin_country, destination_country, cargo_type, created_at')
    .eq('ff_user_id', user.id)
    .order('created_at', { ascending: false }) as { data: TxRow[] | null }

  const all       = txs ?? []
  const completed = all.filter(t => t.status === 'completed')
  const active    = all.filter(t => ['confirmed', 'in_transit', 'delivered'].includes(t.status))

  const totalVolume   = all.reduce((s, t) => s + Number(t.total_amount_usd), 0)
  const totalPaid     = completed.reduce((s, t) => s + Number(t.carrier_payout_usd ?? 0), 0)
  const avgTicket     = all.length > 0 ? totalVolume / all.length : 0

  // Top rutas
  const routeMap: Record<string, { count: number; volume: number }> = {}
  for (const t of all) {
    const key = `${t.origin_country} → ${t.destination_country}`
    if (!routeMap[key]) routeMap[key] = { count: 0, volume: 0 }
    routeMap[key].count++
    routeMap[key].volume += Number(t.total_amount_usd)
  }
  const topRoutes = Object.entries(routeMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  // Por tipo de carga
  const cargoMap: Record<string, number> = {}
  for (const t of all) {
    cargoMap[t.cargo_type] = (cargoMap[t.cargo_type] ?? 0) + 1
  }
  const topCargo = Object.entries(cargoMap).sort((a, b) => b[1] - a[1])

  // Volumen mensual últimos 6 meses
  const monthlyMap: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
    monthlyMap[key] = 0
  }
  for (const t of all) {
    const d   = new Date(t.created_at)
    const key = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
    if (key in monthlyMap) monthlyMap[key] += Number(t.total_amount_usd)
  }
  const months      = Object.entries(monthlyMap)
  const maxMonthVol = Math.max(...months.map(([, v]) => v), 1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Reportes" subtitle="Análisis de tu actividad en PORTERRA" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Volumen total',    value: `$${totalVolume.toLocaleString('en', { maximumFractionDigits: 0 })}`,   suffix: 'USD', icon: TrendingUp, color: 'text-[#06B6D4]',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Transacciones',    value: all.length.toString(),                                                   suffix: '',    icon: Package,   color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
            { label: 'Activas ahora',    value: active.length.toString(),                                                suffix: '',    icon: BarChart3, color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
            { label: 'Ticket promedio',  value: `$${avgTicket.toLocaleString('en', { maximumFractionDigits: 0 })}`,     suffix: 'USD', icon: DollarSign,color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
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

        <div className="grid grid-cols-3 gap-6">

          {/* Volumen mensual */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-[#1A1A2E] mb-4">Volumen mensual (USD)</h2>
            {months.every(([, v]) => v === 0) ? (
              <div className="flex items-center justify-center h-32 text-sm text-slate-400">Sin datos de transacciones aún</div>
            ) : (
              <div className="flex items-end gap-3 h-32">
                {months.map(([month, vol]) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {vol > 0 ? `$${(vol / 1000).toFixed(0)}k` : ''}
                    </span>
                    <div className="w-full rounded-t-md bg-[#06B6D4]/20 relative" style={{ height: `${Math.max((vol / maxMonthVol) * 80, vol > 0 ? 4 : 0)}px` }}>
                      <div className="absolute inset-0 rounded-t-md bg-[#06B6D4]" style={{ opacity: vol > 0 ? 0.8 : 0 }} />
                    </div>
                    <span className="text-[10px] text-slate-400 capitalize">{month}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel derecho */}
          <div className="space-y-4">

            {/* Top rutas */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={13} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-[#1A1A2E]">Rutas principales</h2>
              </div>
              {topRoutes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Sin datos</p>
              ) : (
                <div className="space-y-2.5">
                  {topRoutes.map(([route, { count, volume }]) => (
                    <div key={route}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-slate-600 font-medium">{route}</span>
                        <span className="text-xs text-slate-400">{count} tx</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-[#06B6D4]" style={{ width: `${(count / (topRoutes[0][1].count || 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por tipo de carga */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package size={13} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-[#1A1A2E]">Tipo de carga</h2>
              </div>
              {topCargo.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Sin datos</p>
              ) : (
                <div className="space-y-2.5">
                  {topCargo.map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{CARGO_LABEL[type] ?? type}</span>
                      <span className="text-xs font-semibold text-[#1A1A2E]">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
