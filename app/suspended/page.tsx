import { Button } from '@/components/ui/button'
import { ShieldOff, Mail } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-[#0F1B2D] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={28} className="text-red-500" />
        </div>

        <h1 className="text-xl font-bold text-[#1A1A2E] mb-2">Cuenta suspendida</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          Tu cuenta ha sido suspendida temporalmente. Por favor contacta al equipo de soporte
          para más información.
        </p>

        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6">
          <Mail size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-slate-600 text-left">
            Escríbenos a{' '}
            <a href="mailto:soporte@porterra.io" className="text-[#06B6D4] font-medium">
              soporte@porterra.io
            </a>{' '}
            para resolver esta situación.
          </p>
        </div>

        <form action={logoutAction}>
          <Button
            type="submit"
            variant="outline"
            className="w-full border-slate-200 text-slate-600"
          >
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  )
}
