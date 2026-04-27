import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, DollarSign, Receipt, Clock, ArrowUpRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:       { label: 'Borrador',    className: 'bg-slate-100 text-slate-500' },
  published:   { label: 'Publicada',   className: 'bg-violet-100 text-violet-700 border-violet-200' },
  confirmed:   { label: 'Confirmada',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  in_transit:  { label: 'En tránsito', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  delivered:   { label: 'Entregada',   className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  completed:   { label: 'Completada',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:   { label: 'Cancelada',   className: 'bg-red-100 text-red-700 border-red-200' },
}

interface TxRow {
  id: string
  reference_number: string | null
  status: string
  total_amount_usd: number
  porterra_fee_usd: number | null
  carrier_payout_usd: number | null
  origin_country: string
  destination_country: string
  created_at: string
}

interface SplitRow {
  amount_usd: number
  status: string
}

export default async function AdminFinancieroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any

  const [{ data: txs }, { data: splits }] = await Promise.all([
    admin
      .from('transactions')
      .select('id, reference_number, status, total_amount_usd, porterra_fee_usd, carrier_payout_usd, origin_country, destination_country, created_at')
      .order('created_at', { ascending: false })
      .limit(100) as Promise<{ data: TxRow[] | null }>,
    admin
      .from('payment_splits')
      .select('amount_usd, status') as Promise<{ data: SplitRow[] | null }>,
  ])

  const allTx     = txs    ?? []
  const allSplits = splits ?? []

  // Métricas
  const totalVolume      = allTx.reduce((s, t) => s + Number(t.total_amount_usd), 0)
  const feesCollected    = allTx
    .filter(t => t.status === 'completed')
    .reduce((s, t) => s + Number(t.porterra_fee_usd ?? 0), 0)
  const feesProjected    = allTx
    .filter(t => !['cancelled', 'draft'].includes(t.status))
    .reduce((s, t) => s + Number(t.porterra_fee_usd ?? 0), 0)
  const pendingSplitsAmt = allSplits
    .filter(s => ['pending', 'processing'].includes(s.status))
    .reduce((s, p) => s + Number(p.amount_usd), 0)
  const completedCount   = allTx.filter(t => t.status === 'completed').length
  const activeCount      = allTx.filter(t => ['confirmed', 'in_transit', 'delivered'].includes(t.status)).length

  // Distribución por estado
  const byStatus = Object.entries(
    allTx.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Control financiero" subtitle="Visión consolidada de la plataforma" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* KPI cards — fila 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Volumen total',        value: `$${totalVolume.toLocaleString('en', { minimumFractionDigits: 2 })}`,       suffix: 'USD', icon: TrendingUp,   color: 'text-[#06B6D4]',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Comisiones cobradas',  value: `$${feesCollected.toLocaleString('en', { minimumFractionDigits: 2 })}`,     suffix: 'USD', icon: DollarSign,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Comisiones proyect.',  value: `$${feesProjected.toLocaleString('en', { minimumFractionDigits: 2 })}`,     suffix: 'USD', icon: ArrowUpRight, color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
            { label: 'Pagos por liquidar',   value: `$${pendingSplitsAmt.toLocaleString('en', { minimumFractionDigits: 2 })}`,  suffix: 'USD', icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
          ].map(({ label, value, suffix, icon: Icon, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-4`}>
              <Icon size={20} className={`${color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-[#1A1A2E] leading-tight">{value} <span className="text-xs font-normal text-slate-400">{suffix}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Transacciones recientes */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1A1A2E]">Transacciones recientes</h2>
              <span className="text-xs text-slate-400">{allTx.length} total</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-xs font-semibold text-slate-500">Referencia</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Ruta</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Monto</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Comisión</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTx.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center text-sm text-slate-400">
                      No hay transacciones aún
                    </TableCell>
                  </TableRow>
                ) : (
                  allTx.slice(0, 20).map((tx) => {
                    const cfg = STATUS_CONFIG[tx.status]
                    return (
                      <TableRow key={tx.id} className="hover:bg-slate-50/40">
                        <TableCell className="py-2.5">
                          <span className="font-mono text-xs text-slate-500">{tx.reference_number ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {tx.origin_country} → {tx.destination_country}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-[#1A1A2E]">
                          ${Number(tx.total_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm text-emerald-700">
                          ${Number(tx.porterra_fee_usd ?? 0).toLocaleString('en', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Panel derecho */}
          <div className="space-y-4">

            {/* Resumen por estado */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h2 className="text-sm font-semibold text-[#1A1A2E] mb-4">Por estado</h2>
              <div className="space-y-3">
                {byStatus.map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
                  const pct = allTx.length > 0 ? (count / allTx.length) * 100 : 0
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className ?? 'bg-slate-100 text-slate-500'}`}>
                          {cfg?.label ?? status}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">{count}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full bg-[#06B6D4] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {byStatus.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Sin datos</p>
                )}
              </div>
            </div>

            {/* Métricas rápidas */}
            <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#1A1A2E]">Métricas rápidas</h2>
              {[
                { label: 'Transacciones activas',   value: activeCount,                                    suffix: '' },
                { label: 'Completadas',              value: completedCount,                                 suffix: '' },
                { label: 'Take rate efectivo',       value: totalVolume > 0 ? ((feesCollected / totalVolume) * 100).toFixed(2) + '%' : '—', suffix: '' },
                { label: 'Ticket promedio',          value: allTx.length > 0 ? `$${(totalVolume / allTx.length).toLocaleString('en', { maximumFractionDigits: 0 })}` : '—', suffix: '' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-[#1A1A2E]">{value}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
