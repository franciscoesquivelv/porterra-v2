'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateKycStatusAction } from '@/app/actions/admin'
import { CheckCircle, XCircle } from 'lucide-react'
import type { KycStatus } from '@/types/database.types'

interface KycActionsProps {
  userId: string
  currentKyc: KycStatus
  userName: string
}

export function KycActions({ userId, currentKyc, userName }: KycActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNotes, setRejectNotes]         = useState('')

  if (currentKyc === 'approved') {
    return <span className="text-xs text-emerald-600 font-medium">✓ Aprobado</span>
  }
  if (currentKyc === 'rejected') {
    return <span className="text-xs text-slate-400">Rechazado</span>
  }
  if (currentKyc === 'not_started') {
    return <span className="text-xs text-slate-400">Sin documentos</span>
  }

  function handleApprove() {
    if (!confirm(`¿Aprobar KYC de ${userName}?`)) return
    startTransition(async () => {
      const result = await updateKycStatusAction(userId, 'approved')
      if (result.error) toast.error(result.error)
      else toast.success('KYC aprobado')
    })
  }

  function handleReject() {
    startTransition(async () => {
      const result = await updateKycStatusAction(userId, 'rejected', rejectNotes)
      if (result.error) toast.error(result.error)
      else {
        toast.success('KYC rechazado')
        setShowRejectModal(false)
        setRejectNotes('')
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm" variant="outline" disabled={isPending}
          onClick={handleApprove}
          className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        >
          <CheckCircle size={12} className="mr-1" />
          Aprobar
        </Button>
        <Button
          size="sm" variant="outline" disabled={isPending}
          onClick={() => setShowRejectModal(true)}
          className="h-7 px-2.5 text-xs text-red-700 border-red-200 hover:bg-red-50"
        >
          <XCircle size={12} className="mr-1" />
          Rechazar
        </Button>
      </div>

      {/* Modal rechazo con notas */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1A1A2E] mb-1">Rechazar KYC</h3>
            <p className="text-sm text-slate-500 mb-4">Indica el motivo del rechazo para <strong>{userName}</strong>.</p>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              placeholder="Ej: Documento de identidad ilegible, requiere nueva foto..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
            />
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline" className="flex-1"
                onClick={() => setShowRejectModal(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={isPending}
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? 'Rechazando...' : 'Confirmar rechazo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
