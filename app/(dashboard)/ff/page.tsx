import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Package, DollarSign, Clock, TrendingUp, Plus, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface FfProfileRow {
  company_name: string | null
  country: string | null
  credit_limit_usd: number
  is_verified: boolean
}

async function getFfData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: profile } = await db
    .from('ff_profiles')
    .select('company_name, country, credit_limit_usd, is_verified')
    .eq('user_id', userId)
    .single() as { data: FfProfileRow | null }

  return {
    profile,
    stats: { activeTransactions: 0, gmvThisMonth: 0, pendingPayments: 0, porterraFee: 0 },
    recentTransactions: [] as Array<{
      id: string; codigo: string; carrier_name: string;
      origen: string; destino: string; gmv_total: number; estado: string; created_at: string
    }>,
  }
}

const STATUS_TX = {
  draft:      { label: 'Borrador',   className: 'bg-slate-100 text-slate-500 border-slate-200' },
  processing: { label: 'En proceso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed:  { label: 'Completada', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:  { label: 'Cancelada',  className: 'bg-red-100 text-red-700 border-red-200' },
  disputed:   { label: 'En disputa', className: 'bg-amber-100 text-amber-700 border-amber-200' },
} as const

export default async function FfDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { profile, stats, recentTransactions } = await getFfData(supabase, user.id)

  const companyName = profile?.company_name ?? 'Mi empresa'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Dashboard" subtitle={`${companyName} · ${profile?.country ?? ''}`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1A1A2E]">{greeting}, {companyName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <Link href="/ff/transacciones/nueva">
            <Button className="bg-[#06B6D4] hover:bg-[#0891b2] text-white gap-2">
              <Plus size={16} />
              Nueva transacción
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Transacciones activas" value={stats.activeTransactions.toString()} icon={Package} iconColor="#06B6D4" />
          <KPICard title="GMV este mes" value={`$${stats.gmvThisMonth.toLocaleString()}`} suffix="USD" change={0} icon={TrendingUp} iconColor="#10b981" />
          <KPICard title="Pagos pendientes" value={`$${stats.pendingPayments.toLocaleString()}`} suffix="USD" icon={Clock} iconColor="#f59e0b" />
          <KPICard title="Fee PORTERRA" value={`$${stats.porterraFee.toLocaleString()}`} suffix="USD" change={0} icon={DollarSign} iconColor="#8b5cf6" />
        </div>

        {/* Verificación pendiente */}
        {!profile?.is_verified && (
          <div className="bg-[#06B6D4]/8 border border-[#06B6D4]/20 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/15 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-[#06B6D4]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#1A1A2E]">Verificación de empresa pendiente</p>
              <p className="text-xs text-slate-500 mt-0.5">
                El equipo PORTERRA está revisando tu documentación.
              </p>
            </div>
            <Link href="/ff/perfil">
              <Button variant="outline" size="sm" className="text-xs shrink-0 border-[#06B6D4]/30 text-[#06B6D4]">
                Ver estado
              </Button>
            </Link>
          </div>
        )}

        {/* Tabla transacciones */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Transacciones recientes</h2>
            <Link href="/ff/transacciones" className="text-xs text-[#06B6D4] hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Código</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Transportista</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Ruta</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 text-right">GMV</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Package size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">Sin transacciones aún</p>
                        <p className="text-xs text-slate-400 mt-0.5">Crea tu primera transacción para comenzar</p>
                      </div>
                      <Link href="/ff/transacciones/nueva">
                        <Button size="sm" className="bg-[#06B6D4] hover:bg-[#0891b2] text-white text-xs mt-1">
                          <Plus size={14} className="mr-1" />
                          Nueva transacción
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((tx) => {
                  const statusCfg = STATUS_TX[tx.estado as keyof typeof STATUS_TX]
                  return (
                    <TableRow key={tx.id} className="hover:bg-slate-50/50 cursor-pointer">
                      <TableCell className="font-mono text-xs text-[#06B6D4] font-medium py-3">{tx.codigo}</TableCell>
                      <TableCell className="text-sm text-[#1A1A2E]">{tx.carrier_name}</TableCell>
                      <TableCell className="text-sm text-slate-500">{tx.origen} → {tx.destino}</TableCell>
                      <TableCell className="text-sm font-semibold text-[#1A1A2E] text-right">${tx.gmv_total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusCfg?.className ?? ''}`}>
                          {statusCfg?.label ?? tx.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: 'Solicitar factoraje', desc: 'Adelanto sobre facturas pendientes', href: '/ff/factoraje', color: '#06B6D4' },
            { title: 'Generar DUCA', desc: 'Documentación aduanera digital', href: '/ff/duca', color: '#8b5cf6' },
            { title: 'Ver transportistas', desc: 'Red de transportistas verificados', href: '/ff/transportistas', color: '#10b981' },
          ].map((card) => (
            <Link key={card.href} href={card.href}>
              <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm hover:border-slate-200 transition-all cursor-pointer group">
                <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                  <ArrowRight size={16} style={{ color: card.color }} />
                </div>
                <p className="text-sm font-semibold text-[#1A1A2E] group-hover:text-[#06B6D4] transition-colors">{card.title}</p>
                <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
