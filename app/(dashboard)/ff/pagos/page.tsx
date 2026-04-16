import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, Clock, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  pending:    { label: 'Pendiente',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
  processing: { label: 'Procesando',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  paid:       { label: 'Pagado',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:     { label: 'Fallido',     className: 'bg-red-100 text-red-700 border-red-200' },
  reversed:   { label: 'Revertido',   className: 'bg-slate-100 text-slate-500' },
} as const

interface PaymentSplit {
  id: string
  carrier_user_id: string
  split_label: string
  amount_usd: number
  status: string
  due_date: string | null
  created_at: string
  transaction: {
    reference_number: string | null
    cargo_description: string
    origin_country: string
    destination_country: string
  } | null
}

export default async function FFPagosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: splits } = await db
    .from('payment_splits')
    .select(`
      id, carrier_user_id, split_label, amount_usd, status, due_date, created_at,
      transaction:transactions(reference_number, cargo_description, origin_country, destination_country)
    `)
    .in('status', ['pending', 'processing'])
    .order('due_date', { ascending: true })
    .eq('transaction.ff_user_id', user.id) as { data: PaymentSplit[] | null }

  const pending = (splits ?? []).filter(s => s.transaction !== null)
  const totalPending = pending.reduce((s, p) => s + Number(p.amount_usd), 0)
  const overdue = pending.filter(p => p.due_date && new Date(p.due_date) < new Date()).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Pagos a transportistas" subtitle={`${pending.length} pago${pending.length !== 1 ? 's' : ''} por realizar`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Por pagar',     value: `$${totalPending.toLocaleString('en', { minimumFractionDigits: 2 })}`, suffix: 'USD', icon: DollarSign, color: 'text-[#06B6D4]',  bg: 'bg-cyan-50',   border: 'border-cyan-100' },
            { label: 'Pagos activos', value: pending.length.toString(),                                              suffix: '',    icon: Clock,       color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-100' },
            { label: 'Vencidos',      value: overdue.toString(),                                                     suffix: '',    icon: AlertCircle, color: overdue > 0 ? 'text-red-500' : 'text-slate-400', bg: overdue > 0 ? 'bg-red-50' : 'bg-slate-50', border: overdue > 0 ? 'border-red-100' : 'border-slate-100' },
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

        {overdue > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Tienes <strong>{overdue} pago{overdue > 1 ? 's' : ''} vencido{overdue > 1 ? 's' : ''}</strong>. Realiza el pago a los transportistas correspondientes.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Transportista</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Carga</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Concepto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Monto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Vencimiento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <DollarSign size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">No tienes pagos pendientes a transportistas</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((split) => {
                  const cfg = STATUS_CONFIG[split.status as keyof typeof STATUS_CONFIG]
                  const isOverdue = split.due_date && new Date(split.due_date) < new Date()
                  const carrierShort = `${split.carrier_user_id.slice(0, 8)}\u2026`
                  return (
                    <TableRow key={split.id} className="hover:bg-slate-50/40">
                      <TableCell className="text-sm font-mono text-slate-500">{carrierShort}</TableCell>
                      <TableCell className="py-3">
                        <p className="text-xs font-mono text-slate-400">{split.transaction?.reference_number ?? '—'}</p>
                        <p className="text-sm font-medium text-[#1A1A2E] mt-0.5 max-w-[180px] truncate">{split.transaction?.cargo_description ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{split.split_label}</TableCell>
                      <TableCell className="text-sm font-semibold text-[#1A1A2E]">${Number(split.amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {split.due_date ? (
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                            {new Date(split.due_date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {isOverdue && ' \u26A0\uFE0F'}
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${cfg?.className}`}>{cfg?.label ?? split.status}</Badge>
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
