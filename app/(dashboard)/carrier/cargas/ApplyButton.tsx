'use client'

import { useState, useTransition } from 'react'
import { applyToLoadAction } from '@/app/actions/loads'
import { Loader2, Send, X, CheckCircle } from 'lucide-react'

// Por qué hay un campo de notas en la aplicación:
// En el modelo Nuvocargo-inspirado, el carrier puede agregar un mensaje
// al postularse ("Tengo experiencia en esta ruta", "Disponible esta semana").
// Esto ayuda al admin dispatcher a tomar mejores decisiones de asignación,
// especialmente cuando hay múltiples aplicantes con scores similares.

interface Props {
  transactionId: string
}

export function ApplyButton({ transactionId }: Props) {
  const [isPending, startT] = useTransition()
  const [open, setOpen]     = useState(false)
  const [notes, setNotes]   = useState('')
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  async function handleApply() {
    startT(async () => {
      const result = await applyToLoadAction(transactionId, notes.trim() || undefined)
      if (result?.error) { setError(result.error); return }
      setDone(true)
      setOpen(false)
    })
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-violet-700 font-medium bg-violet-50 px-3 py-1.5 rounded-lg">
        <CheckCircle size={12} /> Aplicación enviada
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
      >
        <Send size={12} /> Aplicar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-[#1A1A2E]">Aplicar a esta carga</p>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                El equipo PORTERRA revisará tu aplicación y te notificará si eres seleccionado.
                Tu <strong>score de reputación</strong> es un factor clave en la decisión.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mensaje (opcional)
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4] resize-none"
                  rows={3}
                  placeholder="Experiencia en esta ruta, disponibilidad, notas…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 border border-slate-200 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={isPending}
                className="flex-1 bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isPending ? 'Enviando…' : 'Enviar aplicación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
