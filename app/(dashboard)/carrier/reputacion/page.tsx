import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Star, CheckCircle, Truck, TrendingUp, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface CarrierProfile {
  credit_score: number | null
  is_verified: boolean
  vehicle_type: string | null
  vehicle_plate: string | null
  country: string
  created_at: string
}

const SCORE_LABEL = (s: number) => {
  if (s >= 800) return { label: 'Excelente', color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' }
  if (s >= 650) return { label: 'Bueno',     color: 'text-blue-600',    bg: 'bg-blue-50',    bar: 'bg-blue-500' }
  if (s >= 500) return { label: 'Regular',   color: 'text-amber-600',   bg: 'bg-amber-50',   bar: 'bg-amber-500' }
  return               { label: 'Bajo',      color: 'text-red-600',     bg: 'bg-red-50',     bar: 'bg-red-500' }
}

export default async function CarrierReputacionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any
  const { data: profile } = await admin
    .from('carrier_profiles')
    .select('credit_score, is_verified, vehicle_type, vehicle_plate, country, created_at')
    .eq('user_id', user.id)
    .single() as { data: CarrierProfile | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: txs } = await db
    .from('transactions')
    .select('id, status, total_amount_usd, carrier_payout_usd, created_at')
    .eq('carrier_user_id', user.id)

  const allTx     = txs ?? []
  const completed = allTx.filter((t: { status: string }) => t.status === 'completed').length
  const active    = allTx.filter((t: { status: string }) => ['confirmed', 'in_transit'].includes(t.status)).length
  const totalEarned = allTx
    .filter((t: { status: string }) => t.status === 'completed')
    .reduce((s: number, t: { carrier_payout_usd: number | null }) => s + Number(t.carrier_payout_usd ?? 0), 0)

  const score     = profile?.credit_score ?? 0
  const scoreMeta = SCORE_LABEL(score)
  const scorePct  = Math.min((score / 1000) * 100, 100)

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Mi reputación" subtitle="Tu score y estadísticas en la red PORTERRA" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Score card */}
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-start gap-6">
            <div className={`w-24 h-24 rounded-2xl ${scoreMeta.bg} flex flex-col items-center justify-center shrink-0`}>
              <p className={`text-3xl font-black ${scoreMeta.color}`}>{score > 0 ? score : '—'}</p>
              <p className={`text-xs font-semibold ${scoreMeta.color} mt-0.5`}>{score > 0 ? scoreMeta.label : 'Sin score'}</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-lg font-bold text-[#1A1A2E]">Credit Score PORTERRA</p>
                {profile?.is_verified && (
                  <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={11} /> Verificado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-3">Actualizado en base a tu historial de entregas y pagos</p>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-3 rounded-full ${scoreMeta.bar} transition-all`}
                  style={{ width: `${scorePct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400">0</span>
                <span className="text-[10px] text-slate-400">500</span>
                <span className="text-[10px] text-slate-400">1000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Cargas completadas', value: completed.toString(),                                                         icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Activas ahora',      value: active.toString(),                                                            icon: Truck,       color: 'text-[#06B6D4]',   bg: 'bg-cyan-50',    border: 'border-cyan-100' },
            { label: 'Total generado',     value: `$${totalEarned.toLocaleString('en', { maximumFractionDigits: 0 })}`,         icon: TrendingUp,  color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
            { label: 'Miembro desde',      value: memberSince,                                                                  icon: Star,        color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex items-center gap-3`}>
              <Icon size={18} className={`${color} shrink-0`} />
              <div>
                <p className="text-sm font-bold text-[#1A1A2E] leading-tight">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Perfil del vehículo */}
        {profile && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-[#1A1A2E] mb-4">Perfil de vehículo</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Tipo de vehículo', value: profile.vehicle_type ?? '—' },
                { label: 'Placa',            value: profile.vehicle_plate ?? '—' },
                { label: 'País',             value: profile.country },
                { label: 'Verificado',       value: profile.is_verified ? 'Sí' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm font-semibold text-[#1A1A2E] mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cómo mejorar score */}
        <div className="bg-[#0F1B2D] rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-[#06B6D4]" />
            <h2 className="text-sm font-semibold">Cómo mejorar tu score</h2>
          </div>
          <ul className="space-y-2">
            {[
              'Completa entregas a tiempo sin incidencias',
              'Mantén tu perfil y documentos actualizados',
              'Acepta cargas verificadas en la red PORTERRA',
              'Responde rápido a las asignaciones de carga',
            ].map(tip => (
              <li key={tip} className="flex items-start gap-2 text-xs text-slate-400">
                <CheckCircle size={11} className="text-[#06B6D4] mt-0.5 shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}
