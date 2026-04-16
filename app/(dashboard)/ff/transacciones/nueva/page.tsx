'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTransactionAction } from '@/app/actions/transactions'
import { ArrowLeft } from 'lucide-react'

const COUNTRIES = [
  { value: 'GT', label: 'Guatemala' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'HN', label: 'Honduras' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'PA', label: 'Panamá' },
  { value: 'MX', label: 'México' },
]

const CARGO_TYPES = [
  { value: 'general',      label: 'General' },
  { value: 'refrigerated', label: 'Refrigerado' },
  { value: 'dangerous',    label: 'Mercancía peligrosa' },
  { value: 'oversized',    label: 'Sobredimensionado' },
]

type FormState = { error: string; fieldErrors: Record<string, string>; success?: boolean }
const initial: FormState = { error: '', fieldErrors: {} }

function FieldError({ error }: { error?: string }) {
  if (!error) return null
  return <p className="text-xs text-red-500 mt-1">{error}</p>
}

export default function NuevaTransaccionPage() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    async (_prev: FormState, data: FormData) => {
      const result = await createTransactionAction(data)
      return result ?? initial
    },
    initial
  )

  useEffect(() => {
    if (state.success) router.push('/ff/transacciones')
  }, [state.success, router])

  const fe = state.fieldErrors

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 bg-white">
        <Link href="/ff/transacciones">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowLeft size={13} /> Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-base font-semibold text-[#1A1A2E]">Nueva transacción</h1>
          <p className="text-xs text-slate-500">Crea una carga y asigna un transportista</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <form action={formAction} className="max-w-2xl space-y-6">

          {/* Datos de la carga */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Datos de la carga</h2>

            <div className="space-y-1.5">
              <Label htmlFor="cargo_description" className="text-sm font-medium text-slate-700">Descripción de la carga</Label>
              <Input id="cargo_description" name="cargo_description" placeholder="Ej: 20 pallets de electrodomésticos" className={`h-10 ${fe.cargo_description ? 'border-red-400' : 'border-slate-200'}`} required />
              <FieldError error={fe.cargo_description} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cargo_type" className="text-sm font-medium text-slate-700">Tipo de carga</Label>
                <select id="cargo_type" name="cargo_type" className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#06B6D4]">
                  {CARGO_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="total_amount_usd" className="text-sm font-medium text-slate-700">Monto total (USD)</Label>
                <Input id="total_amount_usd" name="total_amount_usd" type="number" min="1" step="0.01" placeholder="5000.00" className={`h-10 ${fe.total_amount_usd ? 'border-red-400' : 'border-slate-200'}`} required />
                <FieldError error={fe.total_amount_usd} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cargo_weight_kg" className="text-sm font-medium text-slate-700">Peso (kg) <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input id="cargo_weight_kg" name="cargo_weight_kg" type="number" min="0" step="0.1" placeholder="1500" className="h-10 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo_volume_m3" className="text-sm font-medium text-slate-700">Volumen (m³) <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input id="cargo_volume_m3" name="cargo_volume_m3" type="number" min="0" step="0.01" placeholder="12.5" className="h-10 border-slate-200" />
              </div>
            </div>
          </div>

          {/* Ruta */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Ruta</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="origin_country" className="text-sm font-medium text-slate-700">País de origen</Label>
                <select id="origin_country" name="origin_country" required className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#06B6D4]">
                  <option value="">Seleccionar</option>
                  {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <FieldError error={fe.origin_country} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination_country" className="text-sm font-medium text-slate-700">País de destino</Label>
                <select id="destination_country" name="destination_country" required className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#06B6D4]">
                  <option value="">Seleccionar</option>
                  {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <FieldError error={fe.destination_country} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="origin_address" className="text-sm font-medium text-slate-700">Dirección de recogida <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input id="origin_address" name="origin_address" placeholder="Bodega Zona 12, Guatemala" className="h-10 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination_address" className="text-sm font-medium text-slate-700">Dirección de entrega <span className="text-slate-400 font-normal">(opcional)</span></Label>
                <Input id="destination_address" name="destination_address" placeholder="Puerto Cortés, Honduras" className="h-10 border-slate-200" />
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Fechas <span className="text-slate-400 font-normal text-xs">(opcionales)</span></h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pickup_date" className="text-sm font-medium text-slate-700">Fecha de recogida</Label>
                <Input id="pickup_date" name="pickup_date" type="date" className="h-10 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delivery_date" className="text-sm font-medium text-slate-700">Fecha de entrega</Label>
                <Input id="delivery_date" name="delivery_date" type="date" className="h-10 border-slate-200" />
              </div>
            </div>
          </div>

          {state.error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{state.error}</div>
          )}

          <div className="flex gap-3">
            <Link href="/ff/transacciones" className="flex-1">
              <Button type="button" variant="outline" className="w-full h-11">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={pending} className="flex-1 h-11 bg-[#06B6D4] hover:bg-[#0891b2] text-white font-semibold">
              {pending ? 'Creando...' : 'Crear transacción'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
