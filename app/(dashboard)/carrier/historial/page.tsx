import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollText, TrendingUp, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PaymentSplit {
  id: string
  split_label: string
  amount_usd: number
  status: string
  paid_at: string | null
  created_at: string
  transaction: {
    reference_number: string | null
    cargo_description: string
    origin_country: string
    destination_country: string
  } | null
}

const COUNTRY: Record<string, string> = {
  GT: 'GT', HN: 'HN', SV: 'SV', NI: 'NI', CR: 'CR', PA: 'PA', MX: 'MX',
}

export default async function CarrierHistorialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: splits } = await db
    .from('payment_splits')
    .select(`
      id, split_label, amount_usd, status, paid_at, created_at,
      transaction:transactions(reference_number, cargo_description, origin_country, destination_country)
    `)
    .eq('carrier_user_id', user.id)
    .in('status', ['paid', 'reversed'])
    .order('paid_at', { ascending: false }) as { data: PaymentSplit[] | null }

  const history    = splits ?? []
  const totalPaid  = history.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount_usd), 0)
  const countPaid  = history.filter(p => p.status === 'paid').length

  // Calcular promedio mensual (últimos 3 meses)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const recentPaid = history.filter(p => p.status === 'paid' && p.paid_at && new Date(p.paid_at) > threeMonthsAgo)
  const avgMonthly = recentPaid.length > 0 ? recentPaid.reduce((s, p) => s + Number(p.amount_usd), 0) / 3 : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Historial de cobros" subtitle={`${countPaid} pagos recibidos`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total cobrado',    value: `$${totalPaid.toLocaleString('en', { minimumFractionDigits: 2 })}`,  suffix: 'USD', icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Pagos recibidos',  value: countPaid.toString(),                  suffix: '',    icon: CheckCircle, color: 'text-[#06B6D4]',   bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Promedio mensual', value: `$${avgMonthly.toLocaleString('en', { maximumFractionDigits: 0 })}`, suffix: 'USD', icon: ScrollText,  color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
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

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Carga</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Ruta</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Concepto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Monto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Fecha de pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ScrollText size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">Aún no has recibido pagos</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                history.map((split) => (
                  <TableRow key={split.id} className="hover:bg-slate-50/40">
                    <TableCell className="py-3">
                      <p className="text-xs font-mono text-slate-400">{split.transaction?.reference_number ?? '—'}</p>
                      <p className="text-sm font-medium text-[#1A1A2E] mt-0.5 max-w-[180px] truncate">{split.transaction?.cargo_description ?? '—'}</p>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {COUNTRY[split.transaction?.origin_country ?? ''] ?? '—'} → {COUNTRY[split.transaction?.destination_country ?? ''] ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{split.split_label}</TableCell>
                    <TableCell className="text-sm font-semibold text-emerald-700">
                      +${Number(split.amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {split.paid_at
                        ? new Date(split.paid_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
