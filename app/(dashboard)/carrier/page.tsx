import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, Star, Clock, Zap, MessageCircle, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface CarrierProfileRow {
  pii_full_name: string | null
  country: string | null
  credit_score: number | null
  vehicle_plate: string | null
  is_verified: boolean
  whatsapp_enabled: boolean
}

async function getCarrierData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: profile } = await db
    .from('carrier_profiles')
    .select('pii_full_name, country, credit_score, vehicle_plate, is_verified, whatsapp_enabled')
    .eq('user_id', userId)
    .single() as { data: CarrierProfileRow | null }

  return {
    profile,
    stats: { pendingPayout: 0, totalThisMonth: 0, avgRating: 0, ratingCount: 0 },
    pendingPayments: [] as Array<{
      id: string; ff_company: string; amount: number;
      currency: string; route: string; payment_date: string; status: string
    }>,
  }
}

export default async function CarrierDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { profile, stats, pendingPayments } = await getCarrierData(supabase, user.id)

  const firstName = profile?.pii_full_name?.split(' ')[0] ?? 'Transportista'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Mis cobros" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Bienvenida */}
        <div className="bg-gradient-to-r from-[#0F1B2D] to-[#162338] rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <DollarSign size={64} />
          </div>
          <p className="text-slate-400 text-sm">{greeting},</p>
          <h2 className="text-2xl font-bold mt-0.5">{firstName}</h2>
          <p className="text-slate-400 text-sm mt-2">
            {stats.ratingCount > 0
              ? `${stats.ratingCount} calificaciones · Promedio ${stats.avgRating.toFixed(1)}★`
              : 'Completa viajes para construir tu reputación'}
          </p>
          {!profile?.is_verified && (
            <div className="mt-3 flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-lg px-3 py-2 w-fit">
              <Clock size={14} className="text-amber-400" />
              <span className="text-xs text-amber-300 font-medium">Verificación pendiente</span>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            title="Cobros pendientes"
            value={`$${stats.pendingPayout.toLocaleString()}`}
            suffix="USD"
            icon={Clock}
            iconColor="#f59e0b"
            className="col-span-2 lg:col-span-1"
          />
          <KPICard title="Cobrado este mes" value={`$${stats.totalThisMonth.toLocaleString()}`} suffix="USD" change={0} icon={DollarSign} iconColor="#10b981" />
          <KPICard
            title="Calificación"
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
            suffix={stats.ratingCount > 0 ? `★ (${stats.ratingCount})` : ''}
            icon={Star}
            iconColor="#f59e0b"
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

        {/* Pagos pendientes */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Pagos próximos</h2>
            <Link href="/carrier/historial" className="text-xs text-[#06B6D4] hover:underline">Ver historial →</Link>
          </div>
          {pendingPayments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <DollarSign size={20} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Sin pagos pendientes</p>
                <p className="text-xs text-slate-400 mt-0.5">Cuando un FF te asigne a una carga, verás tus cobros aquí.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pendingPayments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50">
                  <div className="w-9 h-9 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center shrink-0">
                    <DollarSign size={16} className="text-[#06B6D4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] truncate">{payment.ff_company}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{payment.route}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#1A1A2E]">${payment.amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(payment.payment_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                    Pendiente
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Soporte WhatsApp */}
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
