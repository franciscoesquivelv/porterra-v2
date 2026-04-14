import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PORTERRA — Acceso',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0F1B2D] flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Gradiente de fondo */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1B2D] via-[#162338] to-[#0d2137]" />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #06B6D4 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, #0891b2 0%, transparent 40%)`,
          }}
        />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#06B6D4] flex items-center justify-center">
              <span className="text-[#0F1B2D] font-black text-lg">P</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">PORTERRA</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Infraestructura de pagos<br />
            para logística en<br />
            <span className="text-[#06B6D4]">Centroamérica.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-md">
            Conecta Freight Forwarders, transportistas y aduana en una sola plataforma.
            Pagos fraccionados, factoring y DUCA digital.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { label: 'Take rate promedio', value: '2.5%' },
              { label: 'GMV potencial CA', value: '$14B' },
              { label: 'Tiempo de pago', value: '< 24h' },
            ].map((stat) => (
              <div key={stat.label} className="border border-slate-700 rounded-xl p-4">
                <p className="text-[#06B6D4] font-bold text-2xl">{stat.value}</p>
                <p className="text-slate-500 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-600 text-sm">
            © 2026 PORTERRA · Confidencial
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white lg:rounded-l-3xl">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-[#06B6D4] flex items-center justify-center">
              <span className="text-[#0F1B2D] font-black">P</span>
            </div>
            <span className="text-[#1A1A2E] font-bold text-lg">PORTERRA</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
