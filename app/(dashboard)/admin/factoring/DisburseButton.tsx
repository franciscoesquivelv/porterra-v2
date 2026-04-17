'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { disburseQuickPayAction, rejectQuickPayAction } from '@/app/actions/quickpay'
import { Zap, XCircle, Loader2 } from 'lucide-react'

interface Props {
  requestId: string
  carrierName: string
  netAmount: number
}

export function DisburseButton({ requestId, carrierName, netAmount }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showReject, setShowReject] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')

  function handleDisburse() {
    if (!confirm(`¿Desembolsar $${netAmount.toLocaleString('en', { minimumFractionDigits: 2 })} a ${carrierName}?`)) return
    startTransition(async () => {
      const result = await disburseQuickPayAction(requestId)
      if (result.error) toast.error(result.error)
      else toast.success('Desembolso confirmado — el carrier recibirá el pago.')
    })
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectQuickPayAction(requestId, rejectNotes || 'Solicitud rechazada por el administrador')
      if (result.error) toast.error(result.error)
      else {
        toast.success('Solicitud rechazada')
        setShowReject(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleDisburse}
        disabled={isPending}
        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
      >
        {isPending ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
        Desembolsar
      </button>
      <button
        onClick={() => setShowReject(true)}
        disabled={isPending}
        className="flex items-center gap-1 text-red-600 border border-red-200 hover:bg-red-50 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <XCircle size={11} />
        Rechazar
      </button>

      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowReject(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1A1A2E] mb-1">Rechazar solicitud</h3>
            <p className="text-sm text-slate-500 mb-4">QuickPay de <strong>{carrierName}</strong></p>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              placeholder="Motivo del rechazo (opcional)..."
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowReject(false)} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="flex-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 font-medium disabled:opacity-60"
              >
                {isPending ? 'Rechazando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
