import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { FileText, CheckCircle, Clock, AlertCircle, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const DUCA_CONFIG = {
  draft:     { label: 'Borrador',   className: 'bg-slate-100 text-slate-500' },
  submitted: { label: 'Enviada',    className: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved:  { label: 'Aprobada',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:  { label: 'Rechazada',  className: 'bg-red-100 text-red-700 border-red-200' },
} as const

const TX_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', confirmed: 'Confirmada', in_transit: 'En tránsito',
  delivered: 'Entregada', completed: 'Completada', cancelled: 'Cancelada',
}

interface TxRow {
  id: string
  reference_number: string | null
  cargo_description: string
  origin_country: string
  destination_country: string
  status: string
  duca_number: string | null
  duca_status: keyof typeof DUCA_CONFIG | null
  total_amount_usd: number
  created_at: string
}

export default async function FfDucaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: txs } = await db
    .from('transactions')
    .select('id, reference_number, cargo_description, origin_country, destination_country, status, duca_number, duca_status, total_amount_usd, created_at')
    .eq('ff_user_id', user.id)
    .not('status', 'eq', 'draft')
    .order('created_at', { ascending: false }) as { data: TxRow[] | null }

  const all       = txs ?? []
  const approved  = all.filter(t => t.duca_status === 'approved').length
  const pending   = all.filter(t => t.duca_status === 'submitted').length
  const missing   = all.filter(t => !t.duca_status || t.duca_status === 'draft').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Documentos DUCA" subtitle="Declaración Única Centroamericana" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Acción principal */}
        <div className="flex justify-end">
          <Link href="/ff/duca/nueva" className="inline-flex items-center gap-2 bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Nueva DUCA-T
          </Link>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <FileText size={15} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            La <strong>DUCA</strong> es el documento aduanero único para el tránsito de mercancías en Centroamérica. Cada transacción internacional requiere una DUCA aprobada antes del cruce fronterizo.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Aprobadas',   value: approved, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'En revisión', value: pending,  icon: Clock,       color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
            { label: 'Sin DUCA',    value: missing,  icon: AlertCircle, color: missing > 0 ? 'text-amber-600' : 'text-slate-400', bg: missing > 0 ? 'bg-amber-50' : 'bg-slate-50', border: missing > 0 ? 'border-amber-100' : 'border-slate-100' },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-4`}>
              <Icon size={20} className={`${color} shrink-0`} />
              <div>
                <p className="text-xl font-bold text-[#1A1A2E]">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {missing > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              Tienes <strong>{missing} transacción{missing > 1 ? 'es' : ''}</strong> sin DUCA generada. Contacta a PORTERRA para iniciar el trámite.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Transacción</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Ruta</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Monto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Núm. DUCA</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado TX</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado DUCA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">No hay transacciones activas aún</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                all.map((tx) => {
                  const ducaCfg = tx.duca_status ? DUCA_CONFIG[tx.duca_status] : null
                  return (
                    <TableRow key={tx.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <p className="text-xs font-mono text-slate-400">{tx.reference_number ?? '—'}</p>
                        <p className="text-sm font-medium text-[#1A1A2E] mt-0.5 max-w-[180px] truncate">{tx.cargo_description}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {tx.origin_country} → {tx.destination_country}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-[#1A1A2E]">
                        ${Number(tx.total_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {tx.duca_number
                          ? <span className="font-mono text-xs text-slate-600">{tx.duca_number}</span>
                          : <span className="text-xs text-slate-300">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-500">{TX_STATUS_LABEL[tx.status] ?? tx.status}</span>
                      </TableCell>
                      <TableCell>
                        {ducaCfg ? (
                          <Badge variant="outline" className={`text-xs ${ducaCfg.className}`}>{ducaCfg.label}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-400">Sin DUCA</Badge>
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
