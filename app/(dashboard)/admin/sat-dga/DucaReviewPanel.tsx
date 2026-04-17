'use client'

import { useState, useTransition } from 'react'
import { approveDucaAction, rejectDucaAction } from '@/app/actions/duca'
import { FileText, CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2, Shield } from 'lucide-react'

interface DucaDoc {
  id: string
  tipo_duca: string
  submitted_at: string | null
  created_at: string
  exportador_nombre: string | null
  importador_nombre: string | null
  pais_procedencia: string | null
  pais_destino: string | null
  mercancias: Array<{ descripcion?: string; codigo_sac?: string }> | null
  valor_transaccion: number | null
  tx_reference: string | null
  tx_cargo: string | null
}

interface Props {
  duca: DucaDoc
  paisLabel: Record<string, string>
  rejectionReasons: string[]
}

export function DucaReviewPanel({ duca, paisLabel, rejectionReasons }: Props) {
  const [isPending, startT]   = useTransition()
  const [expanded, setExpanded] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason]   = useState('')
  const [customReason, setCustomReason] = useState('')
  const [done, setDone]       = useState<'approved' | 'rejected' | null>(null)
  const [error, setError]     = useState('')

  const finalReason = reason === 'Otro motivo' ? customReason : reason

  function handleApprove() {
    startT(async () => {
      const result = await approveDucaAction(duca.id)
      if (result?.error) { setError(result.error); return }
      setDone('approved')
    })
  }

  function handleReject() {
    if (!finalReason.trim()) { setError('Selecciona o escribe el motivo del rechazo'); return }
    startT(async () => {
      const result = await rejectDucaAction(duca.id, finalReason)
      if (result?.error) { setError(result.error); return }
      setDone('rejected')
    })
  }

  const title = duca.tx_reference
    ? `${duca.tx_reference} — ${duca.tx_cargo}`
    : (duca.exportador_nombre ?? duca.tx_cargo ?? 'DUCA sin referencia')

  if (done === 'approved') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-3">
        <CheckCircle size={18} className="text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">DUCA aprobada</p>
          <p className="text-xs text-emerald-600">{title}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <Shield size={12} /> Sistema SAT/DGA
        </div>
      </div>
    )
  }

  if (done === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
        <XCircle size={18} className="text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">DUCA rechazada</p>
          <p className="text-xs text-red-600">{title}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-red-500 font-medium">
          <Shield size={12} /> Sistema SAT/DGA
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-amber-50/30 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <FileText size={16} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#1A1A2E]">{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {duca.tipo_duca} ·{' '}
              Enviada {new Date(duca.submitted_at ?? duca.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
          {expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <>
          {/* Resumen de la DUCA */}
          <div className="px-5 pb-4 space-y-4 border-t border-amber-100">
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1">Exportador</p>
                <p className="text-sm font-medium text-[#1A1A2E]">{duca.exportador_nombre ?? '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1">Importador</p>
                <p className="text-sm font-medium text-[#1A1A2E]">{duca.importador_nombre ?? '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1">Ruta</p>
                <p className="text-sm font-medium text-[#1A1A2E]">
                  {paisLabel[duca.pais_procedencia ?? ''] ?? duca.pais_procedencia ?? '—'}
                  {' → '}
                  {paisLabel[duca.pais_destino ?? ''] ?? duca.pais_destino ?? '—'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-1">Valor en aduana</p>
                <p className="text-sm font-medium text-[#1A1A2E]">
                  {duca.valor_transaccion
                    ? `$${Number(duca.valor_transaccion).toLocaleString('en', { minimumFractionDigits: 2 })} USD`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Mercancías */}
            {duca.mercancias && duca.mercancias.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Mercancías declaradas</p>
                <div className="space-y-1">
                  {duca.mercancias.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-mono text-slate-400 shrink-0">{m.codigo_sac ?? '—'}</span>
                      <span className="text-slate-300">·</span>
                      <span>{m.descripcion ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones */}
            {!rejecting ? (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleApprove}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Aprobar DUCA
                </button>
                <button
                  onClick={() => setRejecting(true)}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-700 border border-red-200 text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  <XCircle size={14} />
                  Rechazar
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-600">Motivo del rechazo (requerido)</p>
                <select
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                  value={reason}
                  onChange={e => { setReason(e.target.value); setError('') }}
                >
                  <option value="">— Seleccionar motivo —</option>
                  {rejectionReasons.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {reason === 'Otro motivo' && (
                  <textarea
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"
                    rows={2}
                    placeholder="Describe el motivo específico del rechazo…"
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                  />
                )}
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setRejecting(false); setReason(''); setError('') }}
                    className="flex-1 border border-slate-200 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={isPending || !finalReason.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                    Confirmar rechazo
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
