import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { MessageCircle, Mail, Phone, HelpCircle, ChevronDown } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FAQ = [
  {
    q: '¿Cuándo recibiré mi pago?',
    a: 'Los pagos se liberan según las fechas acordadas con tu Freight Forwarder. Puedes ver las fechas exactas en la sección "Pagos pendientes". Si hay un retraso, contacta directamente a tu FF o escríbenos a soporte.',
  },
  {
    q: '¿Qué significa que mi perfil está "sin verificar"?',
    a: 'La verificación requiere que el equipo de PORTERRA valide tu documentación (DPI/pasaporte, tarjeta de circulación, licencia). Envíanos los documentos por correo para iniciar el proceso.',
  },
  {
    q: '¿Cómo funciona el factoraje rápido?',
    a: 'El factoraje te permite adelantar el cobro de tus pagos pendientes. PORTERRA te paga el 95% del monto de inmediato y retiene el 5% como comisión. Solo aplica para cobros con más de 3 días de vencimiento.',
  },
  {
    q: '¿Qué es el Credit Score de PORTERRA?',
    a: 'Es un puntaje del 0 al 1000 que refleja tu historial de entregas, puntualidad y comportamiento en la plataforma. Un score alto te da acceso a mejores condiciones de factoraje y más oportunidades de carga.',
  },
  {
    q: '¿Cómo actualizo mis datos de vehículo?',
    a: 'Por el momento los cambios en datos de vehículo se hacen a través de soporte. Contáctanos y el equipo actualizará tu perfil.',
  },
  {
    q: '¿Puedo ver quién es mi Freight Forwarder?',
    a: 'Sí, en la sección "Mis cargas" puedes ver las transacciones asignadas. El contacto directo con tu FF debe hacerse fuera de la plataforma por ahora; estamos trabajando en mensajería interna.',
  },
]

export default async function CarrierSoportePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Soporte" subtitle="Estamos aquí para ayudarte" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">

        {/* Canales de contacto */}
        <div className="grid grid-cols-2 gap-4">
          <a
            href="mailto:soporte@porterra.io"
            className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 hover:border-[#06B6D4]/40 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0 group-hover:bg-[#06B6D4]/10 transition-colors">
              <Mail size={18} className="text-[#06B6D4]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1A2E]">Email</p>
              <p className="text-xs text-slate-400 mt-0.5">soporte@porterra.io</p>
            </div>
          </a>
          <a
            href="https://wa.me/50200000000"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4 hover:border-emerald-200 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
              <MessageCircle size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1A2E]">WhatsApp</p>
              <p className="text-xs text-slate-400 mt-0.5">Lun–Vie 8am–6pm</p>
            </div>
          </a>
        </div>

        {/* Tiempos de respuesta */}
        <div className="bg-[#0F1B2D] rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Phone size={14} className="text-[#06B6D4]" />
            <h2 className="text-sm font-semibold">Tiempos de respuesta</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { canal: 'WhatsApp',       tiempo: '&lt; 2 horas',   nota: 'Horario laboral' },
              { canal: 'Email',          tiempo: '&lt; 24 horas',  nota: 'Días hábiles' },
              { canal: 'Pagos urgentes', tiempo: '&lt; 4 horas',   nota: 'Indicar "URGENTE"' },
              { canal: 'Verificaciones', tiempo: '1–2 días',       nota: 'Con documentos completos' },
            ].map(({ canal, tiempo, nota }) => (
              <div key={canal} className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-slate-400">{canal}</p>
                <p className="text-sm font-semibold text-white mt-0.5" dangerouslySetInnerHTML={{ __html: tiempo }} />
                <p className="text-[10px] text-slate-500 mt-0.5">{nota}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <HelpCircle size={14} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Preguntas frecuentes</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="text-sm font-medium text-[#1A1A2E] pr-4">{q}</span>
                  <ChevronDown size={15} className="text-slate-400 shrink-0 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
