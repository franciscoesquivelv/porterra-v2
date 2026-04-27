import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { FileText, CheckCircle, Clock, AlertCircle, Plus, PenLine } from 'lucide-react'

export const dynamic = 'force-dynamic'

const DUCA_CONFIG = {
  draft:     { label: 'Borrador',   className: 'bg-slate-100 text-slate-500' },
  submitted: { label: 'En revisión', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved:  { label: 'Aprobada',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:  { label: 'Rechazada',  className: 'bg-red-100 text-red-700 border-red-200' },
} as const

type DucaStatus = keyof typeof DUCA_CONFIG

interface DucaRow {
  id: string
  status: DucaStatus
  duca_number: string | null
  tipo_duca: string
  exportador_nombre: string | null
  mercancias: Array<{ descripcion?: string }> | null
  created_at: string
  updated_at: string
  transaction_id: string | null
  // joined from transactions
  tx_reference: string | null
  tx_cargo: string | null
  tx_origin: string | null
  tx_destination: string | null
}

const TABS = [
  { key: 'all',       label: 'Todos' },
  { key: 'draft',     label: 'Borradores' },
  { key: 'submitted', label: 'En revisión' },
  { key: 'approved',  label: 'Aprobadas' },
  { key: 'rejected',  label: 'Rechazadas' },
] as const

type TabKey = typeof TABS[number]['key']

function ducaName(d: DucaRow): string {
  if (d.tx_reference && d.tx_cargo) return `${d.tx_reference} — ${d.tx_cargo}`
  if (d.tx_cargo) return d.tx_cargo
  if (d.exportador_nombre) return d.exportador_nombre
  const firstDesc = d.mercancias?.[0]?.descripcion
  if (firstDesc) return firstDesc
  return `DUCA creada ${new Date(d.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

function ducaRoute(d: DucaRow): string {
  if (d.tx_origin && d.tx_destination) return `${d.tx_origin} → ${d.tx_destination}`
  return '—'
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function FfDucaPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams
  const activeTab: TabKey = (TABS.find(t => t.key === tab)?.key) ?? 'all'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch duca_documents with a manual join via select + then merge
  const { data: ducas } = await db
    .from('duca_documents')
    .select(`
      id, status, duca_number, tipo_duca,
      exportador_nombre, mercancias,
      created_at, updated_at, transaction_id,
      transactions (
        reference_number,
        cargo_description,
        origin_country,
        destination_country
      )
    `)
    .eq('ff_user_id', user.id)
    .order('updated_at', { ascending: false }) as {
    data: Array<{
      id: string
      status: DucaStatus
      duca_number: string | null
      tipo_duca: string
      exportador_nombre: string | null
      mercancias: Array<{ descripcion?: string }> | null
      created_at: string
      updated_at: string
      transaction_id: string | null
      transactions: {
        reference_number: string | null
        cargo_description: string | null
        origin_country: string | null
        destination_country: string | null
      } | null
    }> | null
  }

  // Flatten the join
  const all: DucaRow[] = (ducas ?? []).map(d => ({
    ...d,
    tx_reference:    d.transactions?.reference_number   ?? null,
    tx_cargo:        d.transactions?.cargo_description  ?? null,
    tx_origin:       d.transactions?.origin_country     ?? null,
    tx_destination:  d.transactions?.destination_country ?? null,
  }))

  // KPI counts (always from full list)
  const draftsCount    = all.filter(d => d.status === 'draft').length
  const submittedCount = all.filter(d => d.status === 'submitted').length
  const approvedCount  = all.filter(d => d.status === 'approved').length

  // Filter by tab
  const visible = activeTab === 'all' ? all : all.filter(d => d.status === activeTab)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Documentos DUCA" subtitle="Declaración Única Centroamericana" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Top action */}
        <div className="flex justify-end">
          <Link
            href="/ff/duca/nueva"
            className="inline-flex items-center gap-2 bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Nueva DUCA-T
          </Link>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <FileText size={15} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            La <strong>DUCA-T</strong> es el documento aduanero único para el tránsito de mercancías en Centroamérica.
            Cada transacción internacional requiere una DUCA aprobada antes del cruce fronterizo.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Aprobadas',    value: approvedCount,  icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'En revisión',  value: submittedCount, icon: Clock,       color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
            {
              label: 'Borradores', value: draftsCount, icon: PenLine,
              color: draftsCount > 0 ? 'text-amber-600' : 'text-slate-400',
              bg:    draftsCount > 0 ? 'bg-amber-50'   : 'bg-slate-50',
              border: draftsCount > 0 ? 'border-amber-100' : 'border-slate-100',
            },
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

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {TABS.map(t => {
            const isActive = t.key === activeTab
            return (
              <Link
                key={t.key}
                href={t.key === 'all' ? '/ff/duca' : `/ff/duca?tab=${t.key}`}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-[#1A1A2E] shadow-sm'
                    : 'text-slate-500 hover:text-[#1A1A2E]'
                }`}
              >
                {t.label}
                {t.key === 'draft' && draftsCount > 0 && (
                  <span className="ml-1.5 bg-amber-200 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {draftsCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Documento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Ruta</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Núm. DUCA</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Última edición</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">
                        {activeTab === 'all'    && 'No has creado ninguna DUCA aún'}
                        {activeTab === 'draft'  && 'No tienes borradores guardados'}
                        {activeTab === 'submitted' && 'No hay DUCAs en revisión'}
                        {activeTab === 'approved'  && 'No hay DUCAs aprobadas'}
                        {activeTab === 'rejected'  && 'No hay DUCAs rechazadas'}
                      </p>
                      {activeTab === 'all' && (
                        <Link href="/ff/duca/nueva" className="inline-flex items-center gap-1.5 text-xs bg-[#0F1B2D] text-white px-3 py-1.5 rounded-lg hover:bg-[#0F1B2D]/80 transition-colors">
                          <Plus size={12} /> Crear primera DUCA-T
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((d) => {
                  const cfg = DUCA_CONFIG[d.status]
                  const name = ducaName(d)
                  const route = ducaRoute(d)
                  return (
                    <TableRow key={d.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <div className="flex items-start gap-2">
                          <FileText size={14} className={`mt-0.5 shrink-0 ${d.status === 'draft' ? 'text-slate-300' : 'text-[#06B6D4]'}`} />
                          <div>
                            <p className="text-sm font-medium text-[#1A1A2E] max-w-[220px] truncate">{name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">{d.tipo_duca}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {route}
                      </TableCell>
                      <TableCell>
                        {d.duca_number
                          ? <span className="font-mono text-xs text-slate-600">{d.duca_number}</span>
                          : <span className="text-xs text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(d.updated_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {d.status === 'draft' && (
                          <Link
                            href={`/ff/duca/nueva?duca=${d.id}${d.transaction_id ? `&tx=${d.transaction_id}` : ''}`}
                            className="inline-flex items-center gap-1 text-xs text-[#06B6D4] hover:underline"
                          >
                            <PenLine size={11} /> Continuar
                          </Link>
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
