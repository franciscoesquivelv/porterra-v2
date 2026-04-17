import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { DisburseButton } from './DisburseButton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Receipt, Clock, CheckCircle, DollarSign, Zap, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface QuickPayRow {
  id: string
  split_id: string
  carrier_user_id: string
  gross_amount_usd: number
  fee_usd: number
  net_amount_usd: number
  discount_rate: number
  status: string
  requested_at: string
  disbursed_at: string | null
  split: {
    split_label: string
    transaction: {
      reference_number: string | null
      cargo_description: string
      origin_country: string
      destination_country: string
    } | null
  } | null
}

const PAIS: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

export default async function AdminFactoringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any

  const { data: qpRequests } = await admin
    .from('quickpay_requests')
    .select(`
      id, split_id, carrier_user_id, gross_amount_usd, fee_usd, net_amount_usd,
      discount_rate, status, requested_at, disbursed_at,
      split:payment_splits(
        split_label,
        transaction:transactions(reference_number, cargo_description, origin_country, destination_country)
      )
    `)
    .order('requested_at', { ascending: false }) as { data: QuickPayRow[] | null }

  const adminClient = getAdminClient()
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const nameMap: Record<string, string> = {}
  for (const u of authUsers ?? []) nameMap[u.id] = u.user_metadata?.full_name ?? u.email ?? u.id.substring(0, 8)

  const all       = qpRequests ?? []
  const pending   = all.filter(r => r.status === 'pending')
  const disbursed = all.filter(r => r.status === 'disbursed')
  const totalDisbursed = disbursed.reduce((s, r) => s + Number(r.net_amount_usd), 0)
  const totalFees      = all.filter(r => r.status === 'disbursed').reduce((s, r) => s + Number(r.fee_usd), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="QuickPay — Factoring"
        subtitle="Solicitudes de adelanto de pago de transportistas"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'En revisión',      value: pending.length.toString(),  suffix: '',    icon: Clock,       color: pending.length > 0 ? 'text-amber-600' : 'text-slate-400',   bg: pending.length > 0 ? 'bg-amber-50' : 'bg-slate-50', border: pending.length > 0 ? 'border-amber-100' : 'border-slate-100' },
            { label: 'Desembolsado',     value: `$${totalDisbursed.toLocaleString('en', { maximumFractionDigits: 0 })}`, suffix: 'USD', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Fees generados',   value: `$${totalFees.toLocaleString('en', { maximumFractionDigits: 0 })}`,      suffix: 'USD', icon: Zap,         color: 'text-[#06B6D4]',   bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Total solicitudes',value: all.length.toString(),      suffix: '',    icon: CheckCircle, color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
          ].map(({ label, value, suffix, icon: Icon, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-4`}>
              <Icon size={20} className={`${color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-[#1A1A2E]">
                  {value} <span className="text-xs font-normal text-slate-400">{suffix}</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {pending.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{pending.length} solicitud{pending.length > 1 ? 'es' : ''}</strong> QuickPay pendiente{pending.length > 1 ? 's' : ''} de desembolso.
            </p>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Todas las solicitudes QuickPay</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Transportista</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Transacción</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Cobro original</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Fee (3%)</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Neto a pagar</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Solicitud</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Zap size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">No hay solicitudes QuickPay aún</p>
                      <p className="text-xs text-slate-400">Aparecerán cuando los carriers soliciten adelantos</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                all.map((req) => {
                  const tx = req.split?.transaction
                  return (
                    <TableRow key={req.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-[#1A1A2E]">{nameMap[req.carrier_user_id] ?? '—'}</p>
                        <p className="text-xs text-[#06B6D4]">{req.carrier_user_id.substring(0, 8)}…</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-mono text-slate-400">{tx?.reference_number ?? '—'}</p>
                        {tx && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {PAIS[tx.origin_country] ?? tx.origin_country} → {PAIS[tx.destination_country] ?? tx.destination_country}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5 max-w-[140px] truncate">{req.split?.split_label}</p>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-[#1A1A2E]">
                        ${Number(req.gross_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-red-500">
                        −${Number(req.fee_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-emerald-600">
                        ${Number(req.net_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(req.requested_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${
                          req.status === 'disbursed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          req.status === 'rejected'  ? 'bg-red-50 text-red-600 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {req.status === 'disbursed' ? 'Desembolsado' : req.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.status === 'pending' ? (
                          <DisburseButton
                            requestId={req.id}
                            carrierName={nameMap[req.carrier_user_id] ?? 'Carrier'}
                            netAmount={Number(req.net_amount_usd)}
                          />
                        ) : req.status === 'disbursed' ? (
                          <span className="text-xs text-emerald-600 font-medium">
                            ✓ {req.disbursed_at ? new Date(req.disbursed_at).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
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
