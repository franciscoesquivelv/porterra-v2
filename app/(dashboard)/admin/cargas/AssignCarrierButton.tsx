'use client'

import { useState, useTransition } from 'react'
import { assignCarrierAction } from '@/app/actions/loads'
import { CheckCircle, Loader2, UserCheck, AlertTriangle } from 'lucide-react'

interface Props {
  transactionId: string
  applicationId: string
  carrierName: string
}

export function AssignCarrierButton({ transactionId, applicationId, carrierName }: Props) {
  const [isPending, startT] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  async function handleAssign() {
    startT(async () => {
      const result = await assignCarrierAction(transactionId, applicationId)
      if (result?.error) { setError(result.error); return }
      setDone(true)
      setConfirming(false)
    })
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <CheckCircle size={13} /> Asignado
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
        <AlertTriangle size={12} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800">¿Asignar a <strong>{carrierName}</strong>?</p>
        <button
          onClick={handleAssign}
          disabled={isPending}
          className="text-xs bg-[#0F1B2D] text-white px-2 py-0.5 rounded font-medium hover:bg-[#0F1B2D]/80 disabled:opacity-60 flex items-center gap-1"
        >
          {isPending ? <Loader2 size={10} className="animate-spin" /> : null}
          Confirmar
        </button>
        <button onClick={() => { setConfirming(false); setError('') }} className="text-xs text-slate-500 hover:text-slate-700">
          Cancelar
        </button>
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 text-xs bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
    >
      <UserCheck size={13} /> Asignar
    </button>
  )
}
