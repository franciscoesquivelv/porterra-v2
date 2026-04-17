import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { KycReviewPanel } from './KycReviewPanel'
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ShieldCheck, Clock, FileText, AlertCircle } from 'lucide-react'
import type { UserRole, KycStatus } from '@/types/database.types'

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  user_id: string
  pii_full_name: string
  porterra_role: UserRole
  porterra_status: string
  kyc_status: KycStatus
  company_name: string | null
  company_country: string | null
  pii_phone: string | null
  created_at: string
  metadata: Record<string, string> | null
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin:             'Admin',
  freight_forwarder: 'Freight Forwarder',
  carrier:           'Transportista',
}

const KYC_CONFIG: Record<KycStatus, { label: string; className: string }> = {
  not_started: { label: 'Sin iniciar',        className: 'bg-slate-100 text-slate-500 border-slate-200' },
  submitted:   { label: 'Pendiente revisión', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:    { label: 'Aprobado',           className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:    { label: 'Rechazado',          className: 'bg-red-100 text-red-700 border-red-200' },
}

export default async function AdminKycPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, user_id, pii_full_name, porterra_role, porterra_status, kyc_status, company_name, company_country, pii_phone, created_at, metadata')
    .neq('porterra_role', 'admin')
    .order('created_at', { ascending: false }) as { data: ProfileRow[] | null }

  // Obtener emails de auth.users
  const adminClient = getAdminClient()
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers ?? []) emailMap[u.id] = u.email ?? ''

  const allProfiles    = profiles ?? []
  const pendingKyc     = allProfiles.filter(p => p.kyc_status === 'submitted')
  const approvedKyc    = allProfiles.filter(p => p.kyc_status === 'approved')
  const rejectedKyc    = allProfiles.filter(p => p.kyc_status === 'rejected')
  const notStartedKyc  = allProfiles.filter(p => p.kyc_status === 'not_started')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Aprobaciones KYC"
        subtitle={`${pendingKyc.length} pendiente${pendingKyc.length !== 1 ? 's' : ''} de revisión`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pendientes',     value: pendingKyc.length,    icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
            { label: 'Aprobados',      value: approvedKyc.length,   icon: ShieldCheck,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Rechazados',     value: rejectedKyc.length,   icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-100' },
            { label: 'Sin documentos', value: notStartedKyc.length, icon: FileText,     color: 'text-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-100' },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-4`}>
              <div className={`${color} shrink-0`}><Icon size={22} /></div>
              <div>
                <p className="text-2xl font-bold text-[#1A1A2E]">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── PENDIENTES DE REVISIÓN ── tarjetas expandibles */}
        {pendingKyc.length > 0 && (
          <div>
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <Clock size={15} className="text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>{pendingKyc.length} usuario{pendingKyc.length > 1 ? 's' : ''}</strong>{' '}
                enviaron información KYC y esperan revisión.
              </p>
            </div>

            <div className="space-y-3">
              {pendingKyc.map(p => (
                <KycReviewPanel
                  key={p.user_id}
                  profile={p}
                  email={emailMap[p.user_id] ?? ''}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── TODOS LOS USUARIOS ── tabla resumen */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Todos los usuarios</h2>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Usuario</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Empresa</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado KYC</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 text-sm py-16">
                    No hay usuarios registrados aún
                  </TableCell>
                </TableRow>
              ) : (
                allProfiles.map((profile) => {
                  const kycCfg = KYC_CONFIG[profile.kyc_status]
                  return (
                    <TableRow key={profile.id} className="hover:bg-slate-50/40">
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-[#1A1A2E]">{profile.pii_full_name}</p>
                        {emailMap[profile.user_id] && (
                          <p className="text-xs text-[#06B6D4] mt-0.5">{emailMap[profile.user_id]}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-600">{profile.company_name ?? '—'}</p>
                        {profile.company_country && (
                          <p className="text-xs text-slate-400 mt-0.5">{profile.company_country}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {ROLE_LABEL[profile.porterra_role]}
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
