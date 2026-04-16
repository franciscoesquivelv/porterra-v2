import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { UserActions } from './UserActions'
import type { UserRole, UserStatus, KycStatus } from '@/types/database.types'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG: Record<UserStatus, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  active:    { label: 'Activo',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  suspended: { label: 'Suspendido', className: 'bg-red-100 text-red-700 border-red-200' },
  rejected:  { label: 'Rechazado', className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin:             'Admin',
  freight_forwarder: 'Freight Forwarder',
  carrier:           'Transportista',
}

const KYC_CONFIG: Record<KycStatus, { label: string; className: string }> = {
  not_started: { label: 'Sin iniciar', className: 'bg-slate-100 text-slate-500' },
  submitted:   { label: 'Enviado',     className: 'bg-blue-100 text-blue-700' },
  approved:    { label: 'Aprobado',    className: 'bg-emerald-100 text-emerald-700' },
  rejected:    { label: 'Rechazado',   className: 'bg-red-100 text-red-700' },
}

interface ProfileRow {
  id: string
  user_id: string
  pii_full_name: string
  porterra_role: UserRole
  porterra_status: UserStatus
  kyc_status: KycStatus
  company_name: string | null
  company_country: string | null
  pii_phone: string | null
  created_at: string
}

interface PageProps {
  searchParams: Promise<{ rol?: string; estado?: string; q?: string }>
}

export default async function AdminUsuariosPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const rolFilter    = params.rol    ?? 'todos'
  const estadoFilter = params.estado ?? 'todos'
  const search       = params.q?.toLowerCase() ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any
  let query = admin
    .from('profiles')
    .select('id, user_id, pii_full_name, porterra_role, porterra_status, kyc_status, company_name, company_country, pii_phone, created_at')
    .order('created_at', { ascending: false })

  if (rolFilter !== 'todos')    query = query.eq('porterra_role', rolFilter)
  if (estadoFilter !== 'todos') query = query.eq('porterra_status', estadoFilter)

  const { data: profiles } = await query as { data: ProfileRow[] | null }

  // Obtener emails de auth.users
  const adminClient = getAdminClient()
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers ?? []) emailMap[u.id] = u.email ?? ''

  const filtered = (profiles ?? []).filter((p) => {
    if (!search) return true
    const email = emailMap[p.user_id] ?? ''
    return (
      p.pii_full_name.toLowerCase().includes(search) ||
      (p.company_name ?? '').toLowerCase().includes(search) ||
      email.toLowerCase().includes(search)
    )
  })

  const pendingCount = (profiles ?? []).filter((p) => p.porterra_status === 'pending').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Gestión de usuarios"
        subtitle={`${filtered.length} usuario${filtered.length !== 1 ? 's' : ''}${pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}` : ''}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Filtro rol */}
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {[
              { value: 'todos',             label: 'Todos' },
              { value: 'freight_forwarder', label: 'FF' },
              { value: 'carrier',           label: 'Transportistas' },
              { value: 'admin',             label: 'Admins' },
            ].map(({ value, label }) => (
              <Link
                key={value}
                href={`/admin/usuarios?rol=${value}&estado=${estadoFilter}${search ? `&q=${search}` : ''}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  rolFilter === value
                    ? 'bg-[#0F1B2D] text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Filtro estado */}
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {[
              { value: 'todos',     label: 'Todos los estados' },
              { value: 'pending',   label: 'Pendientes' },
              { value: 'active',    label: 'Activos' },
              { value: 'suspended', label: 'Suspendidos' },
              { value: 'rejected',  label: 'Rechazados' },
            ].map(({ value, label }) => (
              <Link
                key={value}
                href={`/admin/usuarios?rol=${rolFilter}&estado=${value}${search ? `&q=${search}` : ''}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  estadoFilter === value
                    ? 'bg-[#0F1B2D] text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Búsqueda */}
          <form method="GET" action="/admin/usuarios" className="ml-auto">
            <input type="hidden" name="rol" value={rolFilter} />
            <input type="hidden" name="estado" value={estadoFilter} />
            <input
              name="q"
              defaultValue={search}
              placeholder="Buscar por nombre o empresa..."
              className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
            />
          </form>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500 py-3">Nombre</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Empresa / País</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">KYC</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Registro</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 text-sm py-16">
                    No hay usuarios que coincidan con los filtros
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((profile) => {
                  const statusCfg = STATUS_CONFIG[profile.porterra_status]
                  const kycCfg   = KYC_CONFIG[profile.kyc_status]

                  return (
                    <TableRow key={profile.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-[#1A1A2E]">{profile.pii_full_name}</p>
                        {emailMap[profile.user_id] && (
                          <p className="text-xs text-[#06B6D4] mt-0.5">{emailMap[profile.user_id]}</p>
                        )}
                        {profile.pii_phone && (
                          <p className="text-xs text-slate-400 mt-0.5">{profile.pii_phone}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-600">{profile.company_name ?? '—'}</p>
                        {profile.company_country && (
                          <p className="text-xs text-slate-400 mt-0.5">{profile.company_country}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-500">
                          {ROLE_LABEL[profile.porterra_role]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${kycCfg.className}`}>
                          {kycCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(profile.created_at).toLocaleDateString('es', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <UserActions
                          userId={profile.user_id}
                          currentStatus={profile.porterra_status}
                          userName={profile.pii_full_name}
                        />
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
