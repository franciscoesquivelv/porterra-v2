import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, TrendingUp, Clock, ShieldCheck, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  pii_full_name: string
  porterra_role: string
  porterra_status: string
  kyc_status: string
  company_name: string | null
  created_at: string
}

interface ConfigRow {
  key: string
  value: string
}

async function getAdminStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: totalUsers },
    { count: pendingUsers },
    { data: recentProfiles },
    { data: configs },
    { data: txThisMonth },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('porterra_status', 'pending'),
    db.from('profiles')
      .select('id, pii_full_name, porterra_role, porterra_status, kyc_status, company_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10) as Promise<{ data: ProfileRow[] | null }>,
    db.from('platform_config')
      .select('key, value')
      .in('key', ['take_rate_pct', 'factoring_discount_rate']) as Promise<{ data: ConfigRow[] | null }>,
    db.from('transactions')
      .select('total_amount_usd, porterra_fee_usd, status')
      .not('status', 'in', '(draft,cancelled)')
      .gte('created_at', startOfMonth.toISOString()) as Promise<{
        data: Array<{ total_amount_usd: number; porterra_fee_usd: number; status: string }> | null
      }>,
  ])

  const configMap = Object.fromEntries((configs ?? []).map((c: ConfigRow) => [c.key, c.value]))
  const txList = txThisMonth ?? []
  const gmvThisMonth      = txList.reduce((s, t) => s + Number(t.total_amount_usd), 0)
  const ingresosPorterra  = txList.reduce((s, t) => s + Number(t.porterra_fee_usd ?? 0), 0)

  return {
    totalUsers:      (totalUsers as number | null) ?? 0,
    pendingUsers:    (pendingUsers as number | null) ?? 0,
    recentProfiles:  (recentProfiles as ProfileRow[]) ?? [],
    takeRate:        configMap['take_rate_pct'] ?? '2.5',
    factoringRate:   configMap['factoring_discount_rate'] ?? '3.5',
    gmvThisMonth,
    ingresosPorterra,
  }
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  active:    { label: 'Activo',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  suspended: { label: 'Suspendido', className: 'bg-red-100 text-red-700 border-red-200' },
  rejected:  { label: 'Rechazado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
} as const

const ROLE_LABEL = {
  admin:             'Admin',
  freight_forwarder: 'Freight Forwarder',
  carrier:           'Transportista',
} as const

const KYC_CONFIG = {
  not_started: { label: 'Sin iniciar', className: 'bg-slate-100 text-slate-500' },
  submitted:   { label: 'Enviado',     className: 'bg-blue-100 text-blue-700' },
  approved:    { label: 'Aprobado',    className: 'bg-emerald-100 text-emerald-700' },
  rejected:    { label: 'Rechazado',   className: 'bg-red-100 text-red-700' },
} as const

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stats = await getAdminStats(supabase)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Dashboard Operativo"
        subtitle={`Take rate: ${stats.takeRate}% · Factoring: ${stats.factoringRate}%`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Usuarios totales"
            value={stats.totalUsers.toString()}
            icon={Users}
            iconColor="#06B6D4"
          />
          <KPICard
            title="Pendientes aprobación"
            value={stats.pendingUsers.toString()}
            icon={Clock}
            iconColor="#f59e0b"
          />
          <KPICard
            title="GMV este mes"
            value={`$${stats.gmvThisMonth.toLocaleString('en', { maximumFractionDigits: 0 })}`}
            suffix="USD"
            change={0}
            icon={TrendingUp}
            iconColor="#10b981"
          />
          <KPICard
            title="Ingresos PORTERRA"
            value={`$${stats.ingresosPorterra.toLocaleString('en', { maximumFractionDigits: 0 })}`}
            suffix="USD"
            change={0}
            icon={ShieldCheck}
            iconColor="#8b5cf6"
          />
        </div>

        {/* Alerta si hay pendientes */}
        {stats.pendingUsers > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {stats.pendingUsers} usuario{stats.pendingUsers > 1 ? 's' : ''} esperando aprobación
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Revisa las solicitudes y verifica el KYC antes de aprobar.
              </p>
            </div>
          </div>
        )}

        {/* Tabla de usuarios recientes */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Usuarios recientes</h2>
            <a href="/admin/usuarios" className="text-xs text-[#06B6D4] hover:underline">
              Ver todos →
            </a>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Nombre</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Empresa</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">KYC</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 text-sm py-10">
                    No hay usuarios registrados aún
                  </TableCell>
                </TableRow>
              ) : (
                stats.recentProfiles.map((profile) => {
                  const statusCfg = STATUS_CONFIG[profile.porterra_status as keyof typeof STATUS_CONFIG]
                  const kycCfg   = KYC_CONFIG[profile.kyc_status as keyof typeof KYC_CONFIG]

                  return (
                    <TableRow key={profile.id} className="hover:bg-slate-50/50 cursor-pointer">
                      <TableCell className="font-medium text-sm text-[#1A1A2E] py-3">
                        {profile.pii_full_name}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {profile.company_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {ROLE_LABEL[profile.porterra_role as keyof typeof ROLE_LABEL] ?? profile.porterra_role}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusCfg?.className ?? ''}`}>
                          {statusCfg?.label ?? profile.porterra_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${kycCfg?.className ?? ''}`}>
                          {kycCfg?.label ?? profile.kyc_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(profile.created_at).toLocaleDateString('es', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Config rápida */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Configuración de plataforma
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-600">Take rate</span>
                <span className="text-sm font-semibold text-[#06B6D4]">{stats.takeRate}%</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-600">Descuento factoring</span>
                <span className="text-sm font-semibold text-[#06B6D4]">{stats.factoringRate}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Estado del sistema
            </p>
            <div className="space-y-2">
              {[
                { label: 'Base de datos', status: true },
                { label: 'Autenticación', status: true },
                { label: 'Pagos (PSP)',   status: false },
                { label: 'KYC (Truora)', status: false },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${item.status ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={`text-xs font-medium ${item.status ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {item.status ? 'Conectado' : 'Pendiente config'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
