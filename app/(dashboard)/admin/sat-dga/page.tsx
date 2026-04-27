import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { FileText, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { DucaReviewPanel } from './DucaReviewPanel'

export const dynamic = 'force-dynamic'

// ── Nota de arquitectura ──────────────────────────────────────────────────────
// Esta sección simula el sistema SAT/DGA (Superintendencia de Administración
// Tributaria / Dirección General de Aduanas) de los países centroamericanos.
//
// En producción, PORTERRA se conectaría con el sistema TICA (Tecnología de
// Información para el Control Aduanero) del SIECA vía webservices XML.
// El flujo sería: PORTERRA → envía DUCA en formato SIECA v4.1 → TICA procesa
// → devuelve número de aprobación o rechazo con código de error.
//
// Para el prototipo, el admin actúa como ese sistema externo, aprobando
// o rechazando DUCAs manualmente. Esto permite demostrar el flujo completo
// sin necesitar la integración real.
// ─────────────────────────────────────────────────────────────────────────────

const PAIS: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

// Razones comunes de rechazo del SAT/DGA (para facilitar el demo)
export const REJECTION_REASONS = [
  'Datos del exportador incompletos o incorrectos',
  'Código SAC de mercancía no reconocido',
  'Peso declarado no coincide con la guía de transporte',
  'Aduana de entrada no corresponde a la ruta declarada',
  'Información del vehículo incompleta',
  'Documentos de soporte faltantes',
  'Valor en aduana fuera del rango esperado para el tipo de mercancía',
  'Otro motivo',
]

interface DucaDoc {
  id: string
  status: string
  tipo_duca: string
  submitted_at: string | null
  created_at: string
  exportador_nombre: string | null
  importador_nombre: string | null
  pais_procedencia: string | null
  pais_destino: string | null
  mercancias: Array<{ descripcion?: string; codigo_sac?: string }> | null
  valor_transaccion: number | null
  transaction_id: string | null
  // joined
  tx_reference: string | null
  tx_cargo: string | null
}

export default async function SatDgaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.app_metadata?.porterra_role !== 'admin') redirect('/admin')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: ducas } = await db
    .from('duca_documents')
    .select(`
      id, status, tipo_duca, submitted_at, created_at,
      exportador_nombre, importador_nombre,
      pais_procedencia, pais_destino,
      mercancias, valor_transaccion,
      transaction_id,
      transactions ( reference_number, cargo_description )
    `)
    .in('status', ['submitted', 'approved', 'rejected'])
    .order('submitted_at', { ascending: false }) as {
    data: Array<{
      id: string
      status: string
      tipo_duca: string
      submitted_at: string | null
      created_at: string
      exportador_nombre: string | null
      importador_nombre: string | null
      pais_procedencia: string | null
      pais_destino: string | null
      mercancias: Array<{ descripcion?: string; codigo_sac?: string }> | null
      valor_transaccion: number | null
      transaction_id: string | null
      transactions: { reference_number: string | null; cargo_description: string | null } | null
    }> | null
  }

  const all: DucaDoc[] = (ducas ?? []).map(d => ({
    ...d,
    tx_reference: d.transactions?.reference_number ?? null,
    tx_cargo:     d.transactions?.cargo_description ?? null,
  }))

  const pending   = all.filter(d => d.status === 'submitted')
  const approved  = all.filter(d => d.status === 'approved')
  const rejected  = all.filter(d => d.status === 'rejected')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="SAT / DGA · Revisión Aduanera"
        subtitle="Sistema simulado de aprobación DUCA — Prototipo PORTERRA"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Banner de simulación — muy visible */}
        <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3">
          <Shield size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Entorno simulado · SAT/DGA</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Esta sección simula la autoridad aduanera centroamericana. En producción, PORTERRA
              se conecta con el sistema TICA/SIECA v4.1 para aprobación electrónica automática.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Pendientes de revisión', value: pending.length,  icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
            { label: 'Aprobadas',               value: approved.length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Rechazadas',              value: rejected.length, icon: AlertTriangle, color: 'text-red-500',   bg: 'bg-red-50',     border: 'border-red-100' },
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

        {/* DUCAs pendientes — la sección principal */}
        {pending.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              Pendientes de resolución
            </h2>
            <div className="space-y-3">
              {pending.map(duca => (
                <DucaReviewPanel
                  key={duca.id}
                  duca={duca}
                  paisLabel={PAIS}
                  rejectionReasons={REJECTION_REASONS}
                />
              ))}
            </div>
          </div>
        )}

        {/* Historial */}
        {(approved.length > 0 || rejected.length > 0) && (
          <div>
            <h2 className="text-sm font-semibold text-[#1A1A2E] mb-3">Historial de resoluciones</h2>
            <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
              {[...approved, ...rejected]
                .sort((a, b) => new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime())
                .map(duca => (
                  <div key={duca.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileText size={14} className={duca.status === 'approved' ? 'text-emerald-500' : 'text-red-400'} />
                      <div>
                        <p className="text-sm font-medium text-[#1A1A2E]">
                          {duca.tx_reference ? `${duca.tx_reference} — ` : ''}{duca.tx_cargo ?? duca.exportador_nombre ?? 'DUCA'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {PAIS[duca.pais_procedencia ?? ''] ?? duca.pais_procedencia} → {PAIS[duca.pais_destino ?? ''] ?? duca.pais_destino}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${
                      duca.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {duca.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}

        {all.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-100 py-20 text-center">
            <FileText size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No hay DUCAs enviadas para revisión aún</p>
          </div>
        )}
      </div>
    </div>
  )
}
