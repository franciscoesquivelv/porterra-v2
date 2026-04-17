'use client'

import { useState, useTransition } from 'react'
import { confirmDeliveryAction } from '@/app/actions/transactions'
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react'

// Este botón es una acción de alto impacto: confirmar la entrega activa
// la liberación del saldo final al carrier. Por eso tiene un paso
// de confirmación ("¿Estás seguro?") antes de ejecutar.

export function ConfirmDeliveryButton({ transactionId }: { transactionId: string }) {
  const [isPending, startT] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  async function handleConfirm() {
    startT(async () => {
      const result = await confirmDeliveryAction(transactionId)
      if (result?.error) { setError(result.error); return }
      setDone(true)
      setConfirming(false)
    })
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <CheckCircle size={13} /> Entrega confirmada
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-1.5">
        <AlertTriangle size={12} className="text-cyan-600 shrink-0" />
        <p className="text-xs text-cyan-800">¿Confirmar recepción correcta?</p>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="text-xs bg-cyan-600 text-white px-2 py-0.5 rounded font-medium hover:bg-cyan-700 disabled:opacity-60 flex items-center gap-1"
        >
          {isPending ? <Loader2 size={10} className="animate-spin" /> : null}
          Sí, confirmar
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </button>
        {error && <p className="text-[10px] text-red-500 ml-1">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
    >
      <CheckCircle size={12} /> Confirmar entrega
    </button>
  )
}
