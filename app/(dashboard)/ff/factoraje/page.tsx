import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Receipt, Clock, CheckCircle, XCircle, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  pending:   { label: 'En revisión',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:  { label: 'Aprobado',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  disbursed: { label: 'Desembolsado', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  repaid:    { label: 'Repagado',     className: 'bg-slate-100 text-slate-500' },
  rejected:  { label: 'Rechazado',    className: 'bg-red-100 text-red-700 border-red-200' },
} as const

interface FactoringRequest {
  id: string
  transaction_id: string
  requested_amount_usd: number
  discount_rate: number
  net_amount_usd: number
  status: keyof typeof STATUS_CONFIG
  created_at: string
  transaction: {
    reference_number: string | null
    cargo_description: string
    total_amount_usd: number
  } | null
}

export default async function FfFactorajePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: requests } = await db
    .from('factoring_requests')
    .select(`
      id, transaction_id, requested_amount_usd, discount_rate, net_amount_usd, status, created_at,
      transaction:transactions(reference_number, cargo_description, total_amount_usd)
    `)
    .eq('ff_user_id', user.id)
    .order('created_at', { ascending: false }) as { data: FactoringRequest[] | null }

  const all         = requests ?? []
  const pending     = all.filter(r => r.status === 'pending').length
  const disbursed   = all.filter(r => r.status === 'disbursed')
  const totalNet    = disbursed.reduce((s, r) => s + Number(r.net_amount_usd), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Factoraje" subtitle="Adelanto de facturas sobre transacciones completadas" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            El <strong>factoraje</strong> te permite adelantar el cobro de tus facturas. PORTERRA anticipa hasta el <strong>97%</strong> del valor de la transacción una vez confirmada, descontando la tasa de factoraje configurada.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total adelantado',  value: `$${totalNet.toLocaleString('en', { minimumFractionDigits: 2 })}`, suffix: 'USD', icon: Receipt,     color: 'text-[#06B6D4]',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'En revisión',       value: pending.toString(),                                                  suffix: '',    icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
            { label: 'Desembolsados',     value: disbursed.length.toString(),                                         suffix: '',    icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
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

        {/* Tabla de solicitudes */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Mis solicitudes</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Transacción</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Monto solicitado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Tasa</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Monto neto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Fecha</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Receipt size={32} className="text-slate-300" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">No tienes solicitudes de factoraje</p>
                        <p className="text-xs text-slate-400 mt-1">Cuando tengas transacciones confirmadas podrás solicitar adelantos aquí</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                all.map((req) => {
                  const cfg = STATUS_CONFIG[req.status]
                  return (
                    <TableRow key={req.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <p className="text-xs font-mono text-slate-400">{req.transaction?.reference_number ?? '—'}</p>
                        <p className="text-sm font-medium text-[#1A1A2E] mt-0.5 max-w-[200px] truncate">{req.transaction?.cargo_description ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-[#1A1A2E]">
                        ${Number(req.requested_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{Number(req.discount_rate).toFixed(2)}%</TableCell>
                      <TableCell className="text-sm font-semibold text-emerald-700">
                        ${Number(req.net_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(req.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
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

      </div>
    </div>
  )
}
