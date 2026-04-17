'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDucaDraftAction, submitDucaAction } from '@/app/actions/duca'
import type { DucaFormData, MercanciaItem } from '@/app/actions/duca'
import { Button } from '@/components/ui/button'
import {
  ChevronRight, ChevronLeft, Save, Send, Plus, Trash2,
  MapPin, Building2, Truck, User, Package, CheckCircle, Loader2
} from 'lucide-react'

// ── Constantes ────────────────────────────────────────────────────────────────

const PAISES = ['GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'MX']
const PAIS_LABEL: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

// Aduanas principales por corredor CA (fuente: SIECA + DGA)
const ADUANAS: Record<string, string[]> = {
  GT: ['La Mesilla', 'El Carmen', 'Tecún Umán / Ciudad Hidalgo', 'Agua Caliente', 'El Florido', 'Corinto', 'Las Chinamas', 'San Cristóbal', 'Valle Nuevo', 'Pedro de Alvarado'],
  HN: ['Agua Caliente', 'El Florido', 'Corinto', 'El Espino', 'Las Manos', 'Guasaule', 'El Amatillo'],
  SV: ['Las Chinamas', 'San Cristóbal', 'Valle Nuevo', 'El Amatillo', 'El Poy'],
  NI: ['El Espino', 'Las Manos', 'Guasaule', 'Peñas Blancas'],
  CR: ['Peñas Blancas', 'Paso Canoas', 'Sixaola'],
  PA: ['Paso Canoas', 'Sixaola'],
  MX: ['Ciudad Hidalgo', 'Talismán', 'La Mesilla'],
}

const TIPOS_DOC = ['NIT', 'RTN', 'RUC', 'Cédula Jurídica', 'DUI', 'Pasaporte', 'Otro']
const CLASES_BULTO = ['Cajas', 'Pallets', 'Sacos', 'Tambores', 'Contenedor', 'Granel', 'Otro']
const STEPS = [
  { id: 1, label: 'Ruta',          icon: MapPin },
  { id: 2, label: 'Exportador',    icon: Building2 },
  { id: 3, label: 'Importador',    icon: Building2 },
  { id: 4, label: 'Tránsito',      icon: MapPin },
  { id: 5, label: 'Transportista', icon: Truck },
  { id: 6, label: 'Conductor',     icon: User },
  { id: 7, label: 'Mercancías',    icon: Package },
]

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]'
const selectCls = inputCls + ' cursor-pointer'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  transactionId: string | null
  txData: { reference_number: string | null; cargo_description: string; origin_country: string; destination_country: string } | null
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DucaWizard({ transactionId, txData }: Props) {
  const router = useRouter()
  const [step, setStep]           = useState(1)
  const [ducaId, setDucaId]       = useState<string | undefined>(undefined)
  const [isPending, startT]       = useTransition()
  const [saveMsg, setSaveMsg]     = useState('')

  // Estado del formulario
  const [form, setForm] = useState<DucaFormData>({
    transaction_id:    transactionId ?? undefined,
    pais_procedencia:  txData?.origin_country      ?? '',
    pais_destino:      txData?.destination_country ?? '',
    ruta_transito:     [],
    mercancias:        [],
  })

  // Estado para agregar mercancías
  const [newItem, setNewItem] = useState<MercanciaItem>({
    codigo_sac: '', descripcion: '', cantidad_bultos: 1,
    clase_bultos: 'Cajas', pais_origen: 'GT', marca: '', peso_bruto_kg: 0,
  })

  // Estado para agregar paradas de tránsito
  const [newStop, setNewStop] = useState({ pais: 'GT', aduana: '' })

  function set(key: keyof DucaFormData, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  // ── Guardar borrador ────────────────────────────────────────────────────────

  async function handleSave() {
    startT(async () => {
      const result = await saveDucaDraftAction(form, ducaId)
      if (result.error) { setSaveMsg(`Error: ${result.error}`); return }
      if (result.id) setDucaId(result.id)
      setSaveMsg('Borrador guardado')
      setTimeout(() => setSaveMsg(''), 3000)
    })
  }

  // ── Enviar ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    startT(async () => {
      // Guardar datos finales primero
      const saveResult = await saveDucaDraftAction(form, ducaId)
      if (saveResult.error) { setSaveMsg(`Error: ${saveResult.error}`); return }
      const id = saveResult.id ?? ducaId!
      // Cambiar status a submitted
      const submitResult = await submitDucaAction(id)
      if (submitResult.error) { setSaveMsg(`Error: ${submitResult.error}`); return }
      router.push('/ff/duca')
    })
  }

  // ── Mercancías ──────────────────────────────────────────────────────────────

  function addMercancia() {
    if (!newItem.codigo_sac || !newItem.descripcion) return
    set('mercancias', [...(form.mercancias ?? []), { ...newItem }])
    setNewItem({ codigo_sac: '', descripcion: '', cantidad_bultos: 1, clase_bultos: 'Cajas', pais_origen: 'GT', marca: '', peso_bruto_kg: 0 })
  }

  function removeMercancia(i: number) {
    set('mercancias', (form.mercancias ?? []).filter((_, idx) => idx !== i))
  }

  // ── Ruta de tránsito ────────────────────────────────────────────────────────

  function addStop() {
    if (!newStop.aduana) return
    set('ruta_transito', [...(form.ruta_transito ?? []), { ...newStop }])
    setNewStop({ pais: 'GT', aduana: '' })
  }

  function removeStop(i: number) {
    set('ruta_transito', (form.ruta_transito ?? []).filter((_, idx) => idx !== i))
  }

  // ── Render por paso ─────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // ── PASO 1: Ruta ──────────────────────────────────────────────────────
      case 1: return (
        <div className="space-y-5">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">País y aduana de inicio</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País de procedencia" required>
                <select className={selectCls} value={form.pais_procedencia ?? ''} onChange={e => set('pais_procedencia', e.target.value)}>
                  <option value="">– Seleccionar –</option>
                  {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
                </select>
              </Field>
              <Field label="Aduana de inicio" required>
                <select className={selectCls} value={form.aduana_inicio ?? ''} onChange={e => set('aduana_inicio', e.target.value)}>
                  <option value="">– Seleccionar –</option>
                  {(ADUANAS[form.pais_procedencia ?? ''] ?? []).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Depósito de origen">
                <input className={inputCls} placeholder="Almacén, zona franca…" value={form.deposito_origen ?? ''} onChange={e => set('deposito_origen', e.target.value)} />
              </Field>
              <Field label="Lugar de embarque">
                <input className={inputCls} placeholder="Ciudad o dirección de carga" value={form.lugar_embarque ?? ''} onChange={e => set('lugar_embarque', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">País y aduana de destino</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País de destino" required>
                <select className={selectCls} value={form.pais_destino ?? ''} onChange={e => set('pais_destino', e.target.value)}>
                  <option value="">– Seleccionar –</option>
                  {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
                </select>
              </Field>
              <Field label="Aduana de destino" required>
                <select className={selectCls} value={form.aduana_destino ?? ''} onChange={e => set('aduana_destino', e.target.value)}>
                  <option value="">– Seleccionar –</option>
                  {(ADUANAS[form.pais_destino ?? ''] ?? []).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Depósito de destino">
                <input className={inputCls} placeholder="Almacén o zona franca destino" value={form.deposito_destino ?? ''} onChange={e => set('deposito_destino', e.target.value)} />
              </Field>
              <Field label="Lugar de desembarque">
                <input className={inputCls} placeholder="Ciudad o dirección de descarga" value={form.lugar_desembarque ?? ''} onChange={e => set('lugar_desembarque', e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Observaciones">
            <textarea className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4] resize-none" rows={3} maxLength={1500} placeholder="Información adicional para los servicios aduaneros (máx 1,500 caracteres)…" value={form.observaciones ?? ''} onChange={e => set('observaciones', e.target.value)} />
          </Field>
        </div>
      )

      // ── PASO 2: Exportador ────────────────────────────────────────────────
      case 2: return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Información del exportador o proveedor de las mercancías.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Nombre o razón social" required>
                <input className={inputCls} placeholder="Empresa Exportadora S.A." value={form.exportador_nombre ?? ''} onChange={e => set('exportador_nombre', e.target.value)} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Domicilio fiscal" required>
                <input className={inputCls} placeholder="Dirección fiscal completa" value={form.exportador_domicilio ?? ''} onChange={e => set('exportador_domicilio', e.target.value)} />
              </Field>
            </div>
            <Field label="Tipo de documento" required>
              <select className={selectCls} value={form.exportador_tipo_doc ?? ''} onChange={e => set('exportador_tipo_doc', e.target.value)}>
                <option value="">– Tipo –</option>
                {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de documento" required>
              <input className={inputCls} placeholder="Número de identificación tributaria" value={form.exportador_numero_doc ?? ''} onChange={e => set('exportador_numero_doc', e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="País de emisión del documento">
                <select className={selectCls} value={form.exportador_pais_emision ?? ''} onChange={e => set('exportador_pais_emision', e.target.value)}>
                  <option value="">– Seleccionar –</option>
                  {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </div>
      )

      // ── PASO 3: Importador ────────────────────────────────────────────────
      case 3: return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Información del importador o destinatario de las mercancías en el país de destino.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Nombre o razón social" required>
                <input className={inputCls} placeholder="Empresa Importadora S.A." value={form.importador_nombre ?? ''} onChange={e => set('importador_nombre', e.target.value)} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Domicilio fiscal" required>
                <input className={inputCls} placeholder="Dirección fiscal completa" value={form.importador_domicilio ?? ''} onChange={e => set('importador_domicilio', e.target.value)} />
              </Field>
            </div>
            <Field label="Tipo de documento" required>
              <select className={selectCls} value={form.importador_tipo_doc ?? ''} onChange={e => set('importador_tipo_doc', e.target.value)}>
                <option value="">– Tipo –</option>
                {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de documento" required>
              <input className={inputCls} placeholder="Número de identificación tributaria" value={form.importador_numero_doc ?? ''} onChange={e => set('importador_numero_doc', e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="País de emisión del documento">
                <select className={selectCls} value={form.importador_pais_emision ?? ''} onChange={e => set('importador_pais_emision', e.target.value)}>
                  <option value="">– Seleccionar –</option>
                  {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </div>
      )

      // ── PASO 4: Ruta de tránsito ──────────────────────────────────────────
      case 4: return (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Detalla cada aduana de paso en el orden que seguirá la unidad de transporte. El país y aduana de inicio ya fueron ingresados en el Paso 1.</p>

          {/* Paradas agregadas */}
          {(form.ruta_transito ?? []).length > 0 && (
            <div className="space-y-2">
              {(form.ruta_transito ?? []).map((stop, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#06B6D4]/10 border border-[#06B6D4]/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#06B6D4]">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1A1A2E]">{stop.aduana}</p>
                    <p className="text-xs text-slate-400">{PAIS_LABEL[stop.pais] ?? stop.pais}</p>
                  </div>
                  <button onClick={() => removeStop(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Agregar parada */}
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">Agregar aduana de paso</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País">
                <select className={selectCls} value={newStop.pais} onChange={e => setNewStop(s => ({ ...s, pais: e.target.value, aduana: '' }))}>
                  {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
                </select>
              </Field>
              <Field label="Aduana de paso">
                <select className={selectCls} value={newStop.aduana} onChange={e => setNewStop(s => ({ ...s, aduana: e.target.value }))}>
                  <option value="">– Seleccionar –</option>
                  {(ADUANAS[newStop.pais] ?? []).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
            </div>
            <Button onClick={addStop} disabled={!newStop.aduana} size="sm" className="mt-3 bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white gap-1.5">
              <Plus size={13} /> Agregar parada
            </Button>
          </div>
        </div>
      )

      // ── PASO 5: Transportista y vehículo ──────────────────────────────────
      case 5: return (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Transportista autorizado</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código de transportista">
                <input className={inputCls} placeholder="Código SIECA" value={form.transportista_codigo ?? ''} onChange={e => set('transportista_codigo', e.target.value)} />
              </Field>
              <Field label="Nombre del transportista" required>
                <input className={inputCls} placeholder="Razón social o nombre" value={form.transportista_nombre ?? ''} onChange={e => set('transportista_nombre', e.target.value)} />
              </Field>
              <div className="col-span-2">
                <Field label="Correo electrónico">
                  <input className={inputCls} type="email" placeholder="contacto@transportista.com" value={form.transportista_email ?? ''} onChange={e => set('transportista_email', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Unidad de transporte</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Placa" required>
                <input className={inputCls} placeholder="P-123-GT" value={form.vehiculo_placa ?? ''} onChange={e => set('vehiculo_placa', e.target.value)} />
              </Field>
              <Field label="País de registro" required>
                <select className={selectCls} value={form.vehiculo_pais_registro ?? ''} onChange={e => set('vehiculo_pais_registro', e.target.value)}>
                  <option value="">– Seleccionar –</option>
                  {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
                </select>
              </Field>
              <Field label="Marca">
                <input className={inputCls} placeholder="Kenworth, Freightliner…" value={form.vehiculo_marca ?? ''} onChange={e => set('vehiculo_marca', e.target.value)} />
              </Field>
              <Field label="Modelo">
                <input className={inputCls} placeholder="T800, Cascadia…" value={form.vehiculo_modelo ?? ''} onChange={e => set('vehiculo_modelo', e.target.value)} />
              </Field>
              <Field label="VIN / Número de chasis">
                <input className={inputCls} placeholder="17 caracteres" value={form.vehiculo_vin ?? ''} onChange={e => set('vehiculo_vin', e.target.value)} />
              </Field>
              <Field label="Número de motor">
                <input className={inputCls} placeholder="Número de motor" value={form.vehiculo_motor ?? ''} onChange={e => set('vehiculo_motor', e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      )

      // ── PASO 6: Conductor ─────────────────────────────────────────────────
      case 6: return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Datos del piloto o conductor de la unidad de transporte.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primer nombre" required>
              <input className={inputCls} placeholder="Primer nombre" value={form.conductor_primer_nombre ?? ''} onChange={e => set('conductor_primer_nombre', e.target.value)} />
            </Field>
            <Field label="Segundo nombre">
              <input className={inputCls} placeholder="Segundo nombre" value={form.conductor_segundo_nombre ?? ''} onChange={e => set('conductor_segundo_nombre', e.target.value)} />
            </Field>
            <Field label="Primer apellido" required>
              <input className={inputCls} placeholder="Primer apellido" value={form.conductor_primer_apellido ?? ''} onChange={e => set('conductor_primer_apellido', e.target.value)} />
            </Field>
            <Field label="Segundo apellido">
              <input className={inputCls} placeholder="Segundo apellido" value={form.conductor_segundo_apellido ?? ''} onChange={e => set('conductor_segundo_apellido', e.target.value)} />
            </Field>
            <Field label="Tipo de documento" required>
              <select className={selectCls} value={form.conductor_tipo_doc ?? ''} onChange={e => set('conductor_tipo_doc', e.target.value)}>
                <option value="">– Tipo –</option>
                {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de documento" required>
              <input className={inputCls} placeholder="DPI, cédula, pasaporte…" value={form.conductor_numero_doc ?? ''} onChange={e => set('conductor_numero_doc', e.target.value)} />
            </Field>
            <Field label="Número de licencia" required>
              <input className={inputCls} placeholder="Número de licencia de conducir" value={form.conductor_licencia ?? ''} onChange={e => set('conductor_licencia', e.target.value)} />
            </Field>
            <Field label="País de expedición">
              <select className={selectCls} value={form.conductor_pais_exp ?? ''} onChange={e => set('conductor_pais_exp', e.target.value)}>
                <option value="">– Seleccionar –</option>
                {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
              </select>
            </Field>
          </div>
        </div>
      )

      // ── PASO 7: Mercancías ────────────────────────────────────────────────
      case 7: return (
        <div className="space-y-4">
          {/* Lista de mercancías */}
          {(form.mercancias ?? []).length > 0 && (
            <div className="space-y-2">
              {(form.mercancias ?? []).map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#06B6D4] bg-[#06B6D4]/10 px-1.5 py-0.5 rounded">{item.codigo_sac}</span>
                      <p className="text-sm font-medium text-[#1A1A2E]">{item.descripcion}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.cantidad_bultos} {item.clase_bultos} · {item.peso_bruto_kg} kg · Origen: {PAIS_LABEL[item.pais_origen] ?? item.pais_origen}
                    </p>
                  </div>
                  <button onClick={() => removeMercancia(i)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Formulario nueva mercancía */}
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">Agregar mercancía</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código arancelario SAC" required>
                <input className={inputCls} placeholder="ej. 6204.62" value={newItem.codigo_sac} onChange={e => setNewItem(n => ({ ...n, codigo_sac: e.target.value }))} />
              </Field>
              <Field label="País de origen" required>
                <select className={selectCls} value={newItem.pais_origen} onChange={e => setNewItem(n => ({ ...n, pais_origen: e.target.value }))}>
                  {PAISES.map(p => <option key={p} value={p}>{PAIS_LABEL[p]}</option>)}
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="Descripción de la mercancía" required>
                  <input className={inputCls} placeholder="Descripción detallada" value={newItem.descripcion} onChange={e => setNewItem(n => ({ ...n, descripcion: e.target.value }))} />
                </Field>
              </div>
              <Field label="Cantidad de bultos" required>
                <input className={inputCls} type="number" min="1" value={newItem.cantidad_bultos} onChange={e => setNewItem(n => ({ ...n, cantidad_bultos: Number(e.target.value) }))} />
              </Field>
              <Field label="Clase de bultos">
                <select className={selectCls} value={newItem.clase_bultos} onChange={e => setNewItem(n => ({ ...n, clase_bultos: e.target.value }))}>
                  {CLASES_BULTO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Peso bruto (kg)" required>
                <input className={inputCls} type="number" min="0" step="0.1" value={newItem.peso_bruto_kg} onChange={e => setNewItem(n => ({ ...n, peso_bruto_kg: Number(e.target.value) }))} />
              </Field>
              <Field label="Marca">
                <input className={inputCls} placeholder="Marca de la mercancía" value={newItem.marca ?? ''} onChange={e => setNewItem(n => ({ ...n, marca: e.target.value }))} />
              </Field>
            </div>
            <Button onClick={addMercancia} disabled={!newItem.codigo_sac || !newItem.descripcion} size="sm" className="mt-3 bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white gap-1.5">
              <Plus size={13} /> Agregar mercancía
            </Button>
          </div>

          {/* Valores totales */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Valores totales (USD)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor de transacción">
                <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={form.valor_transaccion ?? ''} onChange={e => set('valor_transaccion', Number(e.target.value))} />
              </Field>
              <Field label="Gastos de transporte">
                <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={form.gastos_transporte ?? ''} onChange={e => set('gastos_transporte', Number(e.target.value))} />
              </Field>
              <Field label="Gastos de seguro">
                <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={form.gastos_seguro ?? ''} onChange={e => set('gastos_seguro', Number(e.target.value))} />
              </Field>
              <Field label="Otros gastos">
                <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={form.otros_gastos ?? ''} onChange={e => set('otros_gastos', Number(e.target.value))} />
              </Field>
            </div>
            {/* Valor en aduana calculado */}
            <div className="mt-3 flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-600">Valor en aduana total</span>
              <span className="text-sm font-bold text-[#1A1A2E]">
                ${(
                  (form.valor_transaccion ?? 0) +
                  (form.gastos_transporte ?? 0) +
                  (form.gastos_seguro ?? 0) +
                  (form.otros_gastos ?? 0)
                ).toLocaleString('en', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>
        </div>
      )

      default: return null
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon     = s.icon
          const isActive = step === s.id
          const isDone   = step > s.id
          return (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => isDone && setStep(s.id)}
                className={`flex flex-col items-center gap-1 flex-1 transition-all ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-[#06B6D4] text-white shadow-lg shadow-[#06B6D4]/30' :
                  isDone   ? 'bg-emerald-500 text-white' :
                             'bg-slate-100 text-slate-400'
                }`}>
                  {isDone ? <CheckCircle size={14} /> : <Icon size={14} />}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${isActive ? 'text-[#06B6D4]' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 rounded-full transition-all ${step > s.id ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Card del paso */}
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-[#06B6D4]/10 flex items-center justify-center">
            <span className="text-xs font-bold text-[#06B6D4]">{step}</span>
          </div>
          <h2 className="text-base font-semibold text-[#1A1A2E]">
            {['Ruta', 'Exportador', 'Importador', 'Ruta de tránsito', 'Transportista y vehículo', 'Conductor', 'Mercancías'][step - 1]}
          </h2>
          <span className="text-xs text-slate-400 ml-auto">Paso {step} de 7</span>
        </div>
        {renderStep()}
      </div>

      {/* Controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5 text-slate-600 border-slate-200">
              <ChevronLeft size={15} /> Anterior
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className={`text-xs px-3 py-1.5 rounded-lg ${saveMsg.startsWith('Error') ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
              {saveMsg}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isPending}
            className="gap-1.5 text-slate-600 border-slate-200"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar borrador
          </Button>

          {step < 7 ? (
            <Button onClick={() => setStep(s => s + 1)} className="bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white gap-1.5">
              Siguiente <ChevronRight size={15} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending || (form.mercancias ?? []).length === 0} className="bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white gap-1.5">
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Enviar DUCA
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
