import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Receipt, Clock, CheckCircle, DollarSign, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  pending:   { label: 'En revisión',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:  { label: 'Aprobado',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  disbursed: { label: 'Desembolsado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  repaid:    { label: 'Repagado',     className: 'bg-slate-100 text-slate-500' },
  rejected:  { label: 'Rechazado',    className: 'bg-red-100 text-red-700 border-red-200' },
} as const

interface FactoringRow {
  id: string
  ff_user_id: string
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

export default async function AdminFactoringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any

  const { data: requests } = await admin
    .from('factoring_requests')
    .select(`
      id, ff_user_id, transaction_id, requested_amount_usd, discount_rate, net_amount_usd, status, created_at,
      transaction:transactions(reference_number, cargo_description, total_amount_usd)
    `)
    .order('created_at', { ascending: false }) as { data: FactoringRow[] | null }

  // Obtener emails
  const adminClient = getAdminClient()
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers ?? []) emailMap[u.id] = u.email ?? ''

  const all       = requests ?? []
  const pending   = all.filter(r => r.status === 'pending')
  const disbursed = all.filter(r => r.status === 'disbursed')
  const totalDisbursed = disbursed.reduce((s, r) => s + Number(r.net_amount_usd), 0)
  const totalRequested = all.reduce((s, r) => s + Number(r.requested_amount_usd), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Gestión de factoraje" subtitle="Solicitudes de adelanto de facturas" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total solicitado',  value: `$${totalRequested.toLocaleString('en', { maximumFractionDigits: 0 })}`,  suffix: 'USD', icon: Receipt,     color: 'text-[#06B6D4]',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Desembolsado',      value: `$${totalDisbursed.toLocaleString('en', { maximumFractionDigits: 0 })}`,   suffix: 'USD', icon: DollarSign,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'En revisión',       value: pending.length.toString(),                                                  suffix: '',    icon: Clock,       color: pending.length > 0 ? 'text-amber-600' : 'text-slate-400', bg: pending.length > 0 ? 'bg-amber-50' : 'bg-slate-50', border: pending.length > 0 ? 'border-amber-100' : 'border-slate-100' },
            { label: 'Total solicitudes', value: all.length.toString(),                                                      suffix: '',    icon: CheckCircle, color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
          ].map(({ label, value, suffix, icon: Icon, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-4`}>
              <Icon size={20} className={`${color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-[#1A1A2E]">{value} <span className="text-xs font-normal text-slate-400">{suffix}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {pending.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{pending.length} solicitud{pending.length > 1 ? 'es' : ''}</strong> pendiente{pending.length > 1 ? 's' : ''} de revisión.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">FF</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Transacción</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Solicitado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Tasa</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Neto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Fecha</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">No hay solicitudes de factoraje aún</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                all.map((req) => {
                  const cfg = STATUS_CONFIG[req.status]
                  return (
                    <TableRow key={req.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <p className="text-xs text-[#06B6D4]">{emailMap[req.ff_user_id] ?? '—'}</p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">{req.ff_user_id.substring(0, 8)}…</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-mono text-slate-400">{req.transaction?.reference_number ?? '—'}</p>
                        <p className="text-xs text-slate-600 mt-0.5 max-w-[160px] truncate">{req.transaction?.cargo_description ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-[#1A1A2E]">
                        ${Number(req.requested_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{Number(req.discount_rate).toFixed(2)}%</TableCell>
                      <TableCell className="text-sm font-semibold text-emerald-700">
                        ${Number(req.net_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
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
