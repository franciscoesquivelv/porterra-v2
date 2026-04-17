import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign, Star, Clock, Zap, MessageCircle, ArrowRight,
  Truck, MapPin, Navigation, Package,
} from 'lucide-react'
import { TrackingUpdate } from './cargas/TrackingUpdate'

export const dynamic = 'force-dynamic'

const PAIS: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

const ACTIVE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:  { label: 'Confirmada — pendiente de recogida', color: 'text-blue-700',   bg: 'bg-blue-50' },
  in_transit: { label: 'En tránsito',                        color: 'text-amber-700',  bg: 'bg-amber-50' },
  delivered:  { label: 'Entregada — pendiente confirmación', color: 'text-cyan-700',   bg: 'bg-cyan-50' },
}

interface ActiveTrip {
  id: string
  reference_number: string | null
  cargo_description: string
  status: string
  origin_country: string
  destination_country: string
  carrier_payout_usd: number | null
  pickup_date: string | null
  delivery_date: string | null
}

export default async function CarrierDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: profile }, { data: activeTrips }, { data: splits }] = await Promise.all([
    db.from('carrier_profiles')
      .select('pii_full_name, country, credit_score, vehicle_plate, is_verified')
      .eq('user_id', user.id)
      .single() as Promise<{ data: { pii_full_name: string | null; credit_score: number | null; is_verified: boolean } | null }>,

    // Viajes activos (confirmados, en tránsito, entregados pero pendientes de confirmar)
    db.from('transactions')
      .select('id, reference_number, cargo_description, status, origin_country, destination_country, carrier_payout_usd, pickup_date, delivery_date')
      .eq('carrier_user_id', user.id)
      .in('status', ['confirmed', 'in_transit', 'delivered'])
      .order('created_at', { ascending: false }) as Promise<{ data: ActiveTrip[] | null }>,

    // Payment splits pendientes para calcular cobros
    db.from('payment_splits')
      .select('amount_usd, status')
      .eq('carrier_user_id', user.id) as Promise<{ data: Array<{ amount_usd: number; status: string }> | null }>,
  ])

  const firstName  = profile?.pii_full_name?.split(' ')[0] ?? 'Transportista'
  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const trips      = activeTrips ?? []
  const allSplits  = splits ?? []
  const pendingAmt = allSplits.filter(s => s.status === 'pending').reduce((sum, s) => sum + Number(s.amount_usd), 0)
  const earnedAmt  = allSplits.filter(s => s.status === 'released' || s.status === 'paid').reduce((sum, s) => sum + Number(s.amount_usd), 0)
  const score      = profile?.credit_score ?? 500

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={`${greeting}, ${firstName}`} subtitle="Panel del transportista" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Bienvenida + score */}
        <div className="bg-gradient-to-r from-[#0F1B2D] to-[#162338] rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <Truck size={64} />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{firstName}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <Star size={13} className="text-amber-400" />
                <span className="text-sm text-slate-300">Score: <span className="font-bold text-white">{score}</span>/1000</span>
              </div>
            </div>
            {profile?.is_verified ? (
              <span className="text-xs bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-3 py-1 rounded-full font-medium">
                ✓ Verificado
              </span>
            ) : (
              <span className="text-xs bg-amber-500/20 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                <Clock size={11} /> Verificación pendiente
              </span>
            )}
          </div>
        </div>

        {/* ── VIAJE EN CURSO ── lo más prominente del dashboard */}
        {trips.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
              <Navigation size={14} className="text-[#06B6D4]" />
              {trips.length === 1 ? 'Viaje en curso' : `${trips.length} viajes activos`}
            </h2>
            <div className="space-y-3">
              {trips.map(trip => {
                const cfg = ACTIVE_STATUS_CONFIG[trip.status] ?? ACTIVE_STATUS_CONFIG.confirmed
                return (
                  <div key={trip.id} className={`${cfg.bg} border rounded-xl p-4 ${
                    trip.status === 'in_transit' ? 'border-amber-200' :
                    trip.status === 'delivered'  ? 'border-cyan-200' : 'border-blue-200'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-400">{trip.reference_number ?? '—'}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[#1A1A2E] truncate">{trip.cargo_description}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                          <MapPin size={10} />
                          <span>{PAIS[trip.origin_country] ?? trip.origin_country}</span>
                          <span className="text-slate-300">→</span>
                          <span>{PAIS[trip.destination_country] ?? trip.destination_country}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-sm font-bold text-emerald-700">
                          {trip.carrier_payout_usd ? `$${Number(trip.carrier_payout_usd).toLocaleString('en', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                        {trip.status !== 'delivered' && (
                          <TrackingUpdate transactionId={trip.id} referenceNumber={trip.reference_number} />
                        )}
                        {trip.status === 'delivered' && (
                          <span className="text-xs text-cyan-600 font-medium">Esperando confirmación del FF</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sin viajes activos */}
        {trips.length === 0 && (
          <Link href="/carrier/cargas">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-[#06B6D4]/40 hover:bg-[#06B6D4]/5 transition-colors cursor-pointer">
              <Package size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">Sin viajes activos</p>
              <p className="text-xs text-[#06B6D4] mt-1">Ver cargas disponibles →</p>
            </div>
          </Link>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            title="Por cobrar"
            value={`$${pendingAmt.toLocaleString('en', { minimumFractionDigits: 2 })}`}
            suffix="USD"
            icon={Clock}
            iconColor="#f59e0b"
          />
          <KPICard
            title="Cobrado total"
            value={`$${earnedAmt.toLocaleString('en', { minimumFractionDigits: 2 })}`}
            suffix="USD"
            icon={DollarSign}
            iconColor="#10b981"
          />
        </div>

        {/* Factoraje rápido */}
        <Link href="/carrier/factoraje">
          <div className="bg-[#06B6D4]/10 border border-[#06B6D4]/20 rounded-xl p-4 flex items-center gap-4 hover:bg-[#06B6D4]/15 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[#06B6D4] flex items-center justify-center shrink-0">
              <Zap size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#1A1A2E]">Factoraje rápido — 60 segundos</p>
              <p className="text-xs text-slate-500 mt-0.5">Cobra tus facturas por adelantado. Sin filas, sin papeleo.</p>
            </div>
            <ArrowRight size={16} className="text-[#06B6D4] shrink-0" />
          </div>
        </Link>

        {/* Soporte */}
        <a href="https://wa.me/50499999999?text=Hola%20PORTERRA%2C%20necesito%20ayuda" target="_blank" rel="noreferrer">
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 hover:bg-emerald-100/50 transition-colors cursor-pointer">
            <MessageCircle size={18} className="text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">¿Tienes un problema?</p>
              <p className="text-xs text-emerald-600 mt-0.5">Escríbenos por WhatsApp — respondemos en minutos.</p>
            </div>
            <ArrowRight size={14} className="text-emerald-600 shrink-0" />
          </div>
        </a>

      </div>
    </div>
  )
}
