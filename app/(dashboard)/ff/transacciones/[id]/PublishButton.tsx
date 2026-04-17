'use client'

import { useState, useTransition } from 'react'
import { publishTransactionAction } from '@/app/actions/transactions'
import { Send, Loader2, CheckCircle } from 'lucide-react'

// Por qué este es un Client Component y no un form action inline:
// El botón de publicar necesita feedback visual inmediato (loading + success)
// antes de que la página se recargue. Un Server Action con form haría un
// redirect, pero queremos mostrar un estado de "publicando..." al usuario.

export function PublishButton({ transactionId }: { transactionId: string }) {
  const [isPending, startT] = useTransition()
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  async function handlePublish() {
    startT(async () => {
      const result = await publishTransactionAction(transactionId)
      if (result?.error) { setError(result.error); return }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <CheckCircle size={13} /> Carga publicada
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePublish}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        {isPending ? 'Publicando…' : 'Publicar carga'}
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
