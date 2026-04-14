'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateUserStatusAction } from '@/app/actions/admin'
import { CheckCircle, XCircle, Ban } from 'lucide-react'
import type { UserStatus } from '@/types/database.types'

interface UserActionsProps {
  userId: string
  currentStatus: UserStatus
  userName: string
}

export function UserActions({ userId, currentStatus, userName }: UserActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleAction(newStatus: 'active' | 'rejected' | 'suspended') {
    const labels = {
      active:    `¿Aprobar a ${userName}?`,
      rejected:  `¿Rechazar a ${userName}?`,
      suspended: `¿Suspender a ${userName}?`,
    }
    if (!confirm(labels[newStatus])) return

    startTransition(async () => {
      const result = await updateUserStatusAction(userId, newStatus)
      if (result.error) {
        toast.error(result.error)
      } else {
        const successMsg = {
          active:    'Usuario aprobado',
          rejected:  'Usuario rechazado',
          suspended: 'Usuario suspendido',
        }
        toast.success(successMsg[newStatus])
      }
    })
  }

  if (currentStatus === 'rejected') {
    return <span className="text-xs text-slate-400">Rechazado</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      {currentStatus === 'pending' && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleAction('active')}
          className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
        >
          <CheckCircle size={12} className="mr-1" />
          Aprobar
        </Button>
      )}
      {currentStatus === 'active' && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleAction('suspended')}
          className="h-7 px-2.5 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
        >
          <Ban size={12} className="mr-1" />
          Suspender
        </Button>
      )}
      {currentStatus === 'suspended' && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleAction('active')}
          className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        >
          <CheckCircle size={12} className="mr-1" />
          Reactivar
        </Button>
      )}
      {(currentStatus === 'pending' || currentStatus === 'active') && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleAction('rejected')}
          className="h-7 px-2.5 text-xs text-red-700 border-red-200 hover:bg-red-50"
        >
          <XCircle size={12} className="mr-1" />
          Rechazar
        </Button>
      )}
    </div>
  )
}
