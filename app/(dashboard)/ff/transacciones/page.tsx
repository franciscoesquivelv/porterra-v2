import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Package, TrendingUp, Clock, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  draft:       { label: 'Borrador',     className: 'bg-slate-100 text-slate-500' },
  processing:  { label: 'En proceso',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed:   { label: 'Completada',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:   { label: 'Cancelada',    className: 'bg-red-100 text-red-700 border-red-200' },
  disputed:    { label: 'En disputa',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
} as const

const CARGO_LABEL: Record<string, string> = {
  general:      'General',
  refrigerated: 'Refrigerado',
  dangerous:    'Peligroso',
  oversized:    'Sobredimensionado',
}

const COUNTRY_LABEL: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

interface Transaction {
  id: string
  reference_number: string | null
  cargo_description: string
  cargo_type: string
  status: string
  total_amount_usd: number
  origin_country: string
  destination_country: string
  pickup_date: string | null
  delivery_date: string | null
  created_at: string
}

export default async function FfTransaccionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: transactions } = await db
    .from('transactions')
    .select('id, reference_number, cargo_description, cargo_type, status, total_amount_usd, origin_country, destination_country, pickup_date, delivery_date, created_at')
    .eq('ff_user_id', user.id)
    .order('created_at', { ascending: false }) as { data: Transaction[] | null }

  const all      = transactions ?? []
  const active   = all.filter(t => t.status === 'processing').length
  const completed = all.filter(t => t.status === 'completed').length
  const pending  = all.filter(t => t.status === 'draft').length
  const totalGmv = all.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.total_amount_usd), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Transacciones" subtitle={`${all.length} en total · GMV: $${totalGmv.toLocaleString('en')} USD`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total GMV',    value: `$${totalGmv.toLocaleString('en')}`, suffix: 'USD', icon: TrendingUp, color: 'text-[#06B6D4]',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'En proceso',   value: active.toString(),                    suffix: '',    icon: Package,    color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
            { label: 'Borradores',   value: pending.toString(),                   suffix: '',    icon: Clock,      color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
            { label: 'Completadas',  value: completed.toString(),                 suffix: '',    icon: CheckCircle,color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Todas las transacciones</h2>
            <Link href="/ff/transacciones/nueva">
              <Button size="sm" className="h-8 bg-[#06B6D4] hover:bg-[#0891b2] text-white text-xs gap-1.5">
                <Plus size={13} /> Nueva transacción
              </Button>
            </Link>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Referencia</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Descripción</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Ruta</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Monto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Package size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">No has creado transacciones aún</p>
                      <Link href="/ff/transacciones/nueva">
                        <Button size="sm" className="bg-[#06B6D4] hover:bg-[#0891b2] text-white text-xs">
                          <Plus size={13} className="mr-1" /> Crear primera transacción
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                all.map((t) => {
                  const cfg = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG]
                  return (
                    <TableRow key={t.id} className="hover:bg-slate-50/40 cursor-pointer">
                      <TableCell className="font-mono text-xs text-slate-500">{t.reference_number ?? '—'}</TableCell>
                      <TableCell className="text-sm font-medium text-[#1A1A2E] max-w-[200px] truncate">{t.cargo_description}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {COUNTRY_LABEL[t.origin_country] ?? t.origin_country} → {COUNTRY_LABEL[t.destination_country] ?? t.destination_country}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{CARGO_LABEL[t.cargo_type] ?? t.cargo_type}</TableCell>
                      <TableCell className="text-sm font-semibold text-[#1A1A2E]">${Number(t.total_amount_usd).toLocaleString('en')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${cfg?.className}`}>{cfg?.label ?? t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(t.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
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
