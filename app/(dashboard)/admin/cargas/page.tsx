import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Package, MapPin, Users, Clock, Star } from 'lucide-react'
import { AssignCarrierButton } from './AssignCarrierButton'

export const dynamic = 'force-dynamic'

// ── Por qué esta página existe ────────────────────────────────────────────────
// Esta es la vista del "dispatcher" de PORTERRA — la persona que asigna
// carriers a cargas. En Nuvocargo, este rol lo tenía el equipo de operaciones.
// La página muestra todas las cargas publicadas con sus aplicaciones pendientes,
// el score de cada carrier aplicante, y el botón de asignación.
//
// El score de reputación (0-1000) es el criterio principal de selección.
// En el futuro esto se puede automatizar: si el carrier tiene score > 700
// y la ruta matchea, asignar automáticamente.
// ─────────────────────────────────────────────────────────────────────────────

const PAIS: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

const SCORE_COLOR = (s: number) => {
  if (s >= 800) return 'text-emerald-600 bg-emerald-50'
  if (s >= 650) return 'text-blue-600 bg-blue-50'
  if (s >= 500) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

interface LoadRow {
  id: string
  reference_number: string | null
  cargo_description: string
  cargo_type: string
  origin_country: string
  destination_country: string
  carrier_payout_usd: number | null
  pickup_date: string | null
  delivery_date: string | null
  created_at: string
}

interface Application {
  id: string
  carrier_user_id: string
  status: string
  notes: string | null
  created_at: string
  // enriched
  carrier_name?: string
  carrier_score?: number
  carrier_country?: string
}

export default async function AdminCargasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.app_metadata?.porterra_role !== 'admin') redirect('/admin')

  const adminClient = getAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Cargas publicadas con aplicaciones pendientes
  const { data: loads } = await db
    .from('transactions')
    .select('id, reference_number, cargo_description, cargo_type, origin_country, destination_country, carrier_payout_usd, pickup_date, delivery_date, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false }) as { data: LoadRow[] | null }

  const loadList = loads ?? []

  // Para cada carga, obtener sus aplicaciones
  const applicationsMap: Record<string, Application[]> = {}
  if (loadList.length > 0) {
    const txIds = loadList.map(l => l.id)
    const { data: apps } = await db
      .from('load_applications')
      .select('id, carrier_user_id, transaction_id, status, notes, created_at')
      .in('transaction_id', txIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }) as {
      data: Array<{ id: string; carrier_user_id: string; transaction_id: string; status: string; notes: string | null; created_at: string }> | null
    }

    if (apps && apps.length > 0) {
      // Enriquecer con datos del carrier
      const carrierIds = [...new Set(apps.map(a => a.carrier_user_id))]

      // Obtener perfiles de carrier
      const { data: profiles } = await db
        .from('carrier_profiles')
        .select('user_id, pii_full_name, credit_score, country')
        .in('user_id', carrierIds) as {
        data: Array<{ user_id: string; pii_full_name: string; credit_score: number | null; country: string }> | null
      }

      // Obtener emails del admin client
      const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const emailMap: Record<string, string> = {}
      authUsers?.users?.forEach(u => { emailMap[u.id] = u.email ?? '' })

      const profileMap: Record<string, { name: string; score: number; country: string }> = {}
      ;(profiles ?? []).forEach(p => {
        profileMap[p.user_id] = {
          name:    p.pii_full_name || emailMap[p.user_id] || 'Transportista',
          score:   p.credit_score ?? 500,
          country: p.country,
        }
      })

      // Agrupar por transacción
      for (const app of apps) {
        if (!applicationsMap[app.transaction_id]) applicationsMap[app.transaction_id] = []
        const profile = profileMap[app.carrier_user_id]
        applicationsMap[app.transaction_id].push({
          ...app,
          carrier_name:    profile?.name,
          carrier_score:   profile?.score,
          carrier_country: profile?.country,
        })
      }
    }
  }

  const totalPendingApps = Object.values(applicationsMap).reduce((s, a) => s + a.length, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Asignación de cargas"
        subtitle="Vista de dispatcher · Asigna transportistas a cargas publicadas"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Cargas publicadas', value: loadList.length,        icon: Package, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
            { label: 'Aplicaciones pend.', value: totalPendingApps,      icon: Users,   color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
            { label: 'Sin aplicaciones',   value: loadList.filter(l => !applicationsMap[l.id]?.length).length, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100' },
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

        {/* Lista de cargas con aplicaciones */}
        {loadList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 py-20 text-center">
            <Package size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No hay cargas publicadas pendientes de asignación</p>
          </div>
        ) : (
          <div className="space-y-4">
            {loadList.map((load) => {
              const apps = applicationsMap[load.id] ?? []
              return (
                <div key={load.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  {/* Header de la carga */}
                  <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400">{load.reference_number ?? '—'}</span>
                        <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">Publicada</Badge>
                      </div>
                      <p className="text-sm font-semibold text-[#1A1A2E]">{load.cargo_description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin size={10} />
                          {PAIS[load.origin_country] ?? load.origin_country} → {PAIS[load.destination_country] ?? load.destination_country}
                        </span>
                        {load.carrier_payout_usd && (
                          <span className="font-semibold text-emerald-700">
                            ${Number(load.carrier_payout_usd).toLocaleString('en', { minimumFractionDigits: 2 })} USD al carrier
                          </span>
                        )}
                        {load.pickup_date && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(load.pickup_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{apps.length} aplicación{apps.length !== 1 ? 'es' : ''}</span>
                  </div>

                  {/* Aplicaciones */}
                  {apps.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-xs text-slate-400">Ningún transportista ha aplicado aún</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {apps.map((app) => (
                        <div key={app.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/40 transition-colors">
                          <div className="flex items-center gap-4">
                            {/* Score visual */}
                            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center ${SCORE_COLOR(app.carrier_score ?? 500)}`}>
                              <Star size={12} className="mb-0.5" />
                              <span className="text-xs font-bold leading-none">{app.carrier_score ?? 500}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#1A1A2E]">{app.carrier_name ?? 'Transportista'}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {PAIS[app.carrier_country ?? ''] ?? app.carrier_country ?? '—'} ·
                                Aplicó {new Date(app.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                              </p>
                              {app.notes && (
                                <p className="text-xs text-slate-500 mt-1 italic">"{app.notes}"</p>
                              )}
                            </div>
                          </div>
                          <AssignCarrierButton
                            transactionId={load.id}
                            applicationId={app.id}
                            carrierName={app.carrier_name ?? 'este transportista'}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
