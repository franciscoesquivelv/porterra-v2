'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { requestQuickPayAction } from '@/app/actions/quickpay'
import { Zap, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  splitId: string
  grossAmount: number
  feeRate?: number
}

export function QuickPayButton({ splitId, grossAmount, feeRate = 3 }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone]             = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fee = Math.round(grossAmount * feeRate) / 100
  const net = grossAmount - fee

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
        <CheckCircle size={13} />
        Solicitud enviada
      </div>
    )
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await requestQuickPayAction(splitId)
      if (result.error) {
        toast.error(result.error)
        setShowConfirm(false)
      } else {
        setDone(true)
        toast.success('¡Solicitud enviada! PORTERRA desembolsará en menos de 24h.')
      }
    })
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 bg-[#06B6D4] hover:bg-[#0891b2] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        <Zap size={12} />
        Cobrar ahora
      </button>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-[#1A1A2E]">Confirmar solicitud QuickPay</p>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Monto del cobro</span>
          <span className="font-medium text-[#1A1A2E]">${grossAmount.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Comisión PORTERRA ({feeRate}%)</span>
          <span className="text-red-500">− ${fee.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="border-t border-amber-200 pt-1.5 flex justify-between text-sm">
          <span className="font-semibold text-[#1A1A2E]">Recibirías hoy</span>
          <span className="font-bold text-emerald-600">${net.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setShowConfirm(false)}
          className="flex-1 text-xs text-slate-500 border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {isPending ? 'Enviando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}
