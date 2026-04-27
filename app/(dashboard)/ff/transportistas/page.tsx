import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Truck, Star, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const COUNTRY_LABEL: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

interface CarrierRow {
  id: string
  user_id: string
  pii_full_name: string
  contact_phone: string
  country: string
  vehicle_type: string | null
  vehicle_plate: string | null
  is_verified: boolean
  credit_score: number | null
}

export default async function FfTransportistasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // FF puede ver todos los transportistas activos (RLS carrier_profiles_ff_select)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any
  const { data: carriers } = await admin
    .from('carrier_profiles')
    .select('id, user_id, pii_full_name, contact_phone, country, vehicle_type, vehicle_plate, is_verified, credit_score')
    .order('is_verified', { ascending: false }) as { data: CarrierRow[] | null }

  const all      = carriers ?? []
  const verified = all.filter(c => c.is_verified).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Transportistas" subtitle={`${all.length} en la red · ${verified} verificados`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total en red',  value: all.length,      icon: Truck,       color: 'text-[#06B6D4]',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Verificados',   value: verified,         icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Sin verificar', value: all.length - verified, icon: Star,  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
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

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Transportista</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">País</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Vehículo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Score</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Truck size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400">No hay transportistas en la red aún</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                all.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/40">
                    <TableCell className="py-3">
                      <p className="text-sm font-medium text-[#1A1A2E]">{c.pii_full_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.contact_phone}</p>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{COUNTRY_LABEL[c.country] ?? c.country}</TableCell>
                    <TableCell>
                      <p className="text-sm text-slate-500">{c.vehicle_type ?? '—'}</p>
                      {c.vehicle_plate && <p className="text-xs text-slate-400 font-mono mt-0.5">{c.vehicle_plate}</p>}
                    </TableCell>
                    <TableCell>
                      {c.credit_score !== null ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full bg-[#06B6D4]" style={{ width: `${c.credit_score / 10}%` }} />
                          </div>
                          <span className="text-xs text-slate-600 font-medium">{c.credit_score}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.is_verified ? (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle size={10} className="mr-1" /> Verificado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500">Sin verificar</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
