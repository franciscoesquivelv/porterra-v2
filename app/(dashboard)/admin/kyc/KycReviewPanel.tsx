'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateKycStatusAction } from '@/app/actions/admin'
import {
  ChevronDown, ChevronUp, CheckCircle, XCircle,
  Building2, Hash, Globe, FileKey, User, CreditCard, Clock,
} from 'lucide-react'
import type { KycStatus } from '@/types/database.types'

const PAIS: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

interface ProfileData {
  user_id: string
  pii_full_name: string
  company_name: string | null
  kyc_status: KycStatus
  metadata: Record<string, string> | null
}

interface Props {
  profile: ProfileData
  email: string
}

export function KycReviewPanel({ profile, email }: Props) {
  const [expanded, setExpanded]           = useState(true)
  const [showReject, setShowReject]       = useState(false)
  const [rejectNotes, setRejectNotes]     = useState('')
  const [isPending, startTransition]      = useTransition()

  const meta = profile.metadata ?? {}

  const PRESET_REASONS = [
    'Número fiscal (RTN/NIT/RUC) no válido o no encontrado en registros oficiales',
    'Nombre del representante legal no coincide con los registros de la empresa',
    'Número de licencia de operación vencido o no válido',
    'Razón social incompleta o no coincide con el registro mercantil',
    'Información incompleta — se requieren más detalles',
  ]

  function handleApprove() {
    if (!confirm(`¿Aprobar KYC de ${profile.pii_full_name}?`)) return
    startTransition(async () => {
      const result = await updateKycStatusAction(profile.user_id, 'approved')
      if (result.error) toast.error(result.error)
      else toast.success('KYC aprobado correctamente')
    })
  }

  function handleReject() {
    if (!rejectNotes.trim()) {
      toast.error('Debes indicar el motivo del rechazo')
      return
    }
    startTransition(async () => {
      const result = await updateKycStatusAction(profile.user_id, 'rejected', rejectNotes)
      if (result.error) toast.error(result.error)
      else {
        toast.success('KYC rechazado')
        setShowReject(false)
        setRejectNotes('')
      }
    })
  }

  const submittedAt = meta.submitted_at
    ? new Date(meta.submitted_at).toLocaleDateString('es', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-amber-50/50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
            <span className="text-amber-700 text-sm font-bold">
              {profile.pii_full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1A2E]">{profile.pii_full_name}</p>
            <p className="text-xs text-slate-400">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {submittedAt && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={11} />
              {submittedAt}
            </div>
          )}
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            Pendiente revisión
          </span>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-100">
          {/* Datos enviados */}
          <div className="p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Información enviada por el FF</p>

            {/* Empresa */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Empresa</p>
              <div className="grid grid-cols-2 gap-3">
                <DataField icon={Building2} label="Razón social" value={meta.company_legal_name} />
                <DataField icon={Hash} label="Número fiscal" value={meta.tax_id} />
                <DataField icon={Globe} label="País de emisión" value={meta.tax_id_country ? (PAIS[meta.tax_id_country] ?? meta.tax_id_country) : undefined} />
                <DataField icon={FileKey} label="Licencia de operación" value={meta.license_number || 'No proporcionada'} muted={!meta.license_number} />
              </div>
            </div>

            {/* Representante legal */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Representante legal</p>
              <div className="grid grid-cols-2 gap-3">
                <DataField icon={User} label="Nombre completo" value={meta.legal_rep_name} />
                <DataField icon={CreditCard} label="Número de identificación" value={meta.legal_rep_id} />
              </div>
            </div>

            {/* Declaración jurada */}
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
              <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700">
                El usuario firmó la <strong>declaración jurada</strong> confirmando que la información es verdadera y que los documentos están vigentes.
              </p>
            </div>
          </div>

          {/* Acciones */}
          {!showReject ? (
            <div className="px-5 pb-5 flex gap-3">
              <Button
                onClick={handleApprove}
                disabled={isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <CheckCircle size={14} />
                {isPending ? 'Procesando...' : 'Aprobar KYC'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReject(true)}
                disabled={isPending}
                className="flex-1 text-red-700 border-red-200 hover:bg-red-50 gap-2"
              >
                <XCircle size={14} />
                Rechazar
              </Button>
            </div>
          ) : (
            <div className="px-5 pb-5 space-y-3">
              <p className="text-sm font-medium text-[#1A1A2E]">Motivo del rechazo</p>

              {/* Razones predefinidas */}
              <div className="space-y-1.5">
                {PRESET_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setRejectNotes(r)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                      rejectNotes === r
                        ? 'bg-red-50 border-red-300 text-red-700 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* O escribir motivo personalizado */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">O escribe un motivo personalizado:</p>
                <textarea
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  placeholder="Describe el motivo del rechazo..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowReject(false); setRejectNotes('') }}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={isPending || !rejectNotes.trim()}
                  onClick={handleReject}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isPending ? 'Enviando...' : 'Confirmar rechazo'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DataField({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ElementType
  label: string
  value?: string
  muted?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className={`text-xs font-medium mt-0.5 truncate ${muted ? 'text-slate-400 italic' : 'text-[#1A1A2E]'}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  )
}
