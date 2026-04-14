import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, Mail, CheckCircle } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-[#0F1B2D] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
        {/* Icono */}
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <Clock size={28} className="text-amber-500" />
        </div>

        <h1 className="text-xl font-bold text-[#1A1A2E] mb-2">Cuenta en revisión</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          Tu solicitud fue recibida. El equipo de PORTERRA está revisando tu información
          y documentación. Este proceso normalmente toma <strong>1-2 días hábiles</strong>.
        </p>

        {/* Pasos */}
        <div className="text-left space-y-3 mb-8">
          {[
            { step: 'Solicitud recibida',             done: true },
            { step: 'Revisión de documentación KYC',  done: false },
            { step: 'Verificación de empresa',        done: false },
            { step: 'Cuenta activada',                done: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                item.done
                  ? 'bg-emerald-100'
                  : 'bg-slate-100'
              }`}>
                {item.done ? (
                  <CheckCircle size={14} className="text-emerald-600" />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                )}
              </div>
              <span className={`text-sm ${item.done ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {item.step}
              </span>
            </div>
          ))}
        </div>

        {/* Email info */}
        <div className="flex items-center gap-2 bg-[#06B6D4]/8 border border-[#06B6D4]/20 rounded-lg px-4 py-3 mb-6">
          <Mail size={16} className="text-[#06B6D4] shrink-0" />
          <p className="text-xs text-slate-600 text-left">
            Te notificaremos por email cuando tu cuenta esté activa.
          </p>
        </div>

        <form action={logoutAction}>
          <Button
            type="submit"
            variant="outline"
            className="w-full border-slate-200 text-slate-600 hover:border-slate-300"
          >
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  )
}
