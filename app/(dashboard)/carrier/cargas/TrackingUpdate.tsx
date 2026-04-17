'use client'

import { useState, useTransition } from 'react'
import { addTrackingEventAction } from '@/app/actions/duca'
import { Button } from '@/components/ui/button'
import { MapPin, Loader2, CheckCircle, X } from 'lucide-react'

const EVENT_TYPES = [
  { value: 'origin_pickup',            label: '📦 Carga recogida en origen' },
  { value: 'in_transit',               label: '🚛 En ruta' },
  { value: 'border_approach',          label: '🔶 Aproximándose a frontera' },
  { value: 'border_crossing_start',    label: '🛂 Iniciando trámite fronterizo' },
  { value: 'border_crossing_complete', label: '✅ Cruce fronterizo completado' },
  { value: 'customs_cleared',          label: '🏛️ Aduana despachada' },
  { value: 'in_transit_destination',   label: '🚛 En ruta al destino final' },
  { value: 'delivered',                label: '🎯 Entregado' },
  { value: 'incident',                 label: '⚠️ Incidente' },
  { value: 'delay',                    label: '⏱️ Retraso' },
]

const PAISES = [
  { value: 'GT', label: 'Guatemala' }, { value: 'HN', label: 'Honduras' },
  { value: 'SV', label: 'El Salvador' }, { value: 'NI', label: 'Nicaragua' },
  { value: 'CR', label: 'Costa Rica' }, { value: 'PA', label: 'Panamá' },
  { value: 'MX', label: 'México' },
]

interface Props {
  transactionId: string
  referenceNumber: string | null
}

export function TrackingUpdate({ transactionId, referenceNumber }: Props) {
  const [open, setOpen]         = useState(false)
  const [eventType, setEventType] = useState('')
  const [country, setCountry]   = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes]       = useState('')
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [isPending, startT]     = useTransition()

  function reset() {
    setEventType(''); setCountry(''); setLocation(''); setNotes('')
    setError(''); setSaved(false)
  }

  function handleClose() { setOpen(false); reset() }

  async function handleSubmit() {
    if (!eventType) { setError('Selecciona un tipo de evento'); return }
    startT(async () => {
      const result = await addTrackingEventAction(transactionId, eventType, location, country, notes)
      if (result.error) { setError(result.error); return }
      setSaved(true)
      setTimeout(() => { setOpen(false); reset() }, 1500)
    })
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 px-2.5 text-xs bg-[#06B6D4]/10 text-[#06B6D4] hover:bg-[#06B6D4]/20 border border-[#06B6D4]/20 gap-1"
        variant="outline"
      >
        <MapPin size={11} /> Actualizar
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-[#1A1A2E]">Actualizar estado</p>
                <p className="text-xs text-slate-400 mt-0.5">{referenceNumber ?? transactionId.substring(0, 8)}</p>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {saved ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle size={40} className="text-emerald-500" />
                  <p className="text-sm font-semibold text-[#1A1A2E]">Evento registrado</p>
                  <p className="text-xs text-slate-400">El FF y el admin ya pueden verlo</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de evento <span className="text-red-500">*</span></label>
                    <select
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                      value={eventType}
                      onChange={e => setEventType(e.target.value)}
                    >
                      <option value="">– Seleccionar –</option>
                      {EVENT_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">País actual</label>
                      <select
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                      >
                        <option value="">– Opcional –</option>
                        {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
                      <input
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                        placeholder="Aduana, ciudad…"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
                    <textarea
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4] resize-none"
                      rows={3}
                      placeholder="Detalles adicionales, número de sello, nombre del funcionario…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </>
              )}
            </div>

            {!saved && (
              <div className="flex gap-2 px-5 pb-5">
                <Button variant="outline" onClick={handleClose} className="flex-1 border-slate-200 text-slate-600">
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isPending || !eventType} className="flex-1 bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white gap-1.5">
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                  Registrar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
