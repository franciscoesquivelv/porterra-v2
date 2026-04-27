import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, XCircle, FileText, Shield } from 'lucide-react'
import { KycForm } from './KycForm'

export const dynamic = 'force-dynamic'

// ── Por qué este flujo existe ─────────────────────────────────────────────────
// El KYC (Know Your Customer) es el proceso legal por el que PORTERRA verifica
// que un Freight Forwarder es una empresa legítima antes de dejarla operar.
// En Nuvocargo esto toma 2-3 días hábiles e incluye revisión de:
//   - Constitución legal de la empresa
//   - Número fiscal (RTN/NIT/RUC)
//   - Licencia de operación como agente aduanero
//   - Identidad del representante legal
//
// Para el prototipo, el FF declara sus datos y el admin los aprueba manualmente.
// En producción se integraría con servicios de verificación de identidad
// (Jumio, Onfido, o verificación manual con el SAT/SAR del país correspondiente).
// ─────────────────────────────────────────────────────────────────────────────

const KYC_STATUS = {
  not_started: {
    label: 'Sin iniciar',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: FileText,
  },
  submitted: {
    label: 'En revisión',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Clock,
  },
  approved: {
    label: 'Aprobado',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rechazado',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: XCircle,
  },
}

export default async function FfPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: profile } = await db
    .from('profiles')
    .select('kyc_status, metadata, pii_full_name, company_name')
    .eq('user_id', user.id)
    .single() as {
    data: {
      kyc_status: keyof typeof KYC_STATUS
      metadata: Record<string, string> | null
      pii_full_name: string | null
      company_name: string | null
    } | null
  }

  const kycStatus = profile?.kyc_status ?? 'not_started'
  const cfg       = KYC_STATUS[kycStatus] ?? KYC_STATUS.not_started
  const Icon      = cfg.icon
  const kycData   = profile?.metadata ?? {}

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Perfil y verificación" subtitle="KYC — Conoce a tu cliente" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-2xl">

        {/* Estado actual del KYC */}
        <div className={`flex items-start gap-4 ${cfg.bg} border ${cfg.border} rounded-xl p-4`}>
          <div className={`w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
            <Icon size={18} className={cfg.color} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#1A1A2E]">Verificación de empresa</p>
              <Badge variant="outline" className={`text-xs ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                {cfg.label}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {kycStatus === 'not_started' && 'Completa tu perfil para operar en PORTERRA. El proceso toma menos de 5 minutos.'}
              {kycStatus === 'submitted' && 'El equipo PORTERRA está revisando tu información. Tiempo estimado: 24-48 horas hábiles.'}
              {kycStatus === 'approved' && '¡Tu empresa está verificada! Puedes operar con todas las funciones de PORTERRA.'}
              {kycStatus === 'rejected' && 'Tu verificación fue rechazada. Revisa el motivo y vuelve a enviar.'}
            </p>
            {kycStatus === 'rejected' && kycData.kyc_notes && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs font-medium text-red-700">Motivo del rechazo:</p>
                <p className="text-xs text-red-600 mt-0.5">{kycData.kyc_notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Qué verifica PORTERRA — educativo para el demo */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} className="text-[#06B6D4]" />
            <h2 className="text-sm font-semibold text-[#1A1A2E]">¿Qué verificamos?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'Identidad legal', desc: 'Nombre y número de la empresa registrada' },
              { title: 'Número fiscal', desc: 'RTN, NIT o RUC según el país' },
              { title: 'Representante legal', desc: 'Nombre e identificación del responsable' },
              { title: 'Licencia de operación', desc: 'Permiso como agente aduanero o de carga' },
            ].map(item => (
              <div key={item.title} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-[#1A1A2E]">{item.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Formulario — visible si no está aprobado */}
        {kycStatus !== 'approved' && (
          <KycForm
            kycStatus={kycStatus}
            defaultValues={{
              company_legal_name:  kycData.company_legal_name  ?? profile?.company_name ?? '',
              tax_id:              kycData.tax_id              ?? '',
              tax_id_country:      kycData.tax_id_country      ?? '',
              license_number:      kycData.license_number      ?? '',
              legal_rep_name:      kycData.legal_rep_name      ?? profile?.pii_full_name ?? '',
              legal_rep_id:        kycData.legal_rep_id        ?? '',
            }}
          />
        )}

        {/* Si está aprobado, mostrar los datos verificados */}
        {kycStatus === 'approved' && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-[#1A1A2E] mb-4">Datos verificados</h2>
            <div className="space-y-3">
              {[
                { label: 'Razón social', value: kycData.company_legal_name },
                { label: 'Número fiscal', value: `${kycData.tax_id} (${kycData.tax_id_country})` },
                { label: 'Representante legal', value: kycData.legal_rep_name },
                { label: 'N° de licencia', value: kycData.license_number },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-xs font-medium text-[#1A1A2E]">{value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
