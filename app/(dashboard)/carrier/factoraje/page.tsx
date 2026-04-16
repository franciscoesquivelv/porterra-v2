import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Receipt, Info, Zap, Shield, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CarrierFactorajePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: splits } = await db
    .from('payment_splits')
    .select('id, split_label, amount_usd, status, due_date, created_at')
    .eq('carrier_user_id', user.id)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })

  const pending       = splits ?? []
  const totalPending  = pending.reduce((s: number, p: { amount_usd: number }) => s + Number(p.amount_usd), 0)
  const eligible      = pending.filter((p: { due_date: string | null }) => {
    if (!p.due_date) return false
    const days = Math.ceil((new Date(p.due_date).getTime() - Date.now()) / 86400000)
    return days > 3
  })
  const eligibleTotal = eligible.reduce((s: number, p: { amount_usd: number }) => s + Number(p.amount_usd), 0)
  const advance       = eligibleTotal * 0.95  // 95% advance, 5% discount

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Factoraje rápido" subtitle="Adelanta el cobro de tus pagos pendientes" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Info */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            El <strong>factoraje rápido</strong> te permite recibir hasta el <strong>95%</strong> de tus cobros pendientes de forma inmediata, sin esperar la fecha de vencimiento. PORTERRA descuenta el 5% como comisión.
          </p>
        </div>

        {/* Beneficios */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Zap,    title: 'Liquidez inmediata',   desc: 'Recibe tu dinero en menos de 24 horas hábiles',                 color: 'text-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-100' },
            { icon: Shield, title: 'Sin deuda',            desc: 'No es un préstamo. Es un adelanto de lo que ya ganaste',        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { icon: Clock,  title: 'Proceso simple',       desc: 'Solicita en segundos. Aprobación automática para calificados',  color: 'text-[#06B6D4]',   bg: 'bg-cyan-50',    border: 'border-cyan-100' },
          ].map(({ icon: Icon, title, desc, color, bg, border }) => (
            <div key={title} className={`${bg} border ${border} rounded-xl p-4`}>
              <Icon size={20} className={`${color} mb-2`} />
              <p className="text-sm font-semibold text-[#1A1A2E]">{title}</p>
              <p className="text-xs text-slate-500 mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Simulador */}
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Receipt size={16} className="text-[#06B6D4]" />
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Tu elegibilidad actual</h2>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-8">
              <Receipt size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">No tienes pagos pendientes elegibles</p>
              <p className="text-xs text-slate-400 mt-1">Aparecerán aquí cuando tengas cobros asignados con fecha de vencimiento futura</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-[#1A1A2E]">${totalPending.toLocaleString('en', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-slate-500 mt-1">Total pendiente</p>
                </div>
                <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-[#06B6D4]">${eligibleTotal.toLocaleString('en', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-slate-500 mt-1">Monto elegible</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">${advance.toLocaleString('en', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-slate-500 mt-1">Recibirías (95%)</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700">
                  🚧 <strong>Próximamente:</strong> La funcionalidad de solicitud está en desarrollo. Contacta a soporte para solicitar un adelanto manualmente.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
