'use client'

import { useState, useTransition } from 'react'
import { submitKycAction } from '@/app/actions/kyc'
import { Send, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'

const PAISES = [
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'PA', label: 'Panamá' },
  { value: 'MX', label: 'México' },
]

interface Props {
  kycStatus: string
  defaultValues: {
    company_legal_name: string
    tax_id: string
    tax_id_country: string
    license_number: string
    legal_rep_name: string
    legal_rep_id: string
  }
}

const inputCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]'
const selectCls = inputCls + ' cursor-pointer'

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export function KycForm({ kycStatus, defaultValues }: Props) {
  const [isPending, startT] = useTransition()
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')
  const [declared, setDeclared] = useState(false)

  const [form, setForm] = useState(defaultValues)
  function set(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const isResubmit = kycStatus === 'rejected'

  function handleSubmit() {
    if (!form.company_legal_name || !form.tax_id || !form.tax_id_country || !form.legal_rep_name || !form.legal_rep_id) {
      setError('Completa todos los campos obligatorios')
      return
    }
    if (!declared) {
      setError('Debes aceptar la declaración jurada')
      return
    }
    startT(async () => {
      const result = await submitKycAction(form)
      if (result?.error) { setError(result.error); return }
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
        <CheckCircle size={32} className="text-blue-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-blue-800">Información enviada para revisión</p>
        <p className="text-xs text-blue-600 mt-1">El equipo PORTERRA revisará tu información en 24-48 horas hábiles.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1A1A2E]">
          {isResubmit ? 'Corregir y reenviar información' : 'Información de verificación'}
        </h2>
        {isResubmit && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <AlertTriangle size={10} /> Reenvío
          </span>
        )}
      </div>

      {/* Empresa */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Datos de la empresa</p>
        <div className="space-y-3">
          <Field label="Razón social" required hint="Nombre legal completo como aparece en el registro mercantil">
            <input
              className={inputCls}
              placeholder="Ej: Logística Centro S.A. de C.V."
              value={form.company_legal_name}
              onChange={e => set('company_legal_name', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Número fiscal" required hint="RTN, NIT, RUC según tu país">
              <input
                className={inputCls}
                placeholder="0801-1990-12345"
                value={form.tax_id}
                onChange={e => set('tax_id', e.target.value)}
              />
            </Field>
            <Field label="País de emisión" required>
              <select
                className={selectCls}
                value={form.tax_id_country}
                onChange={e => set('tax_id_country', e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Número de licencia de operación" hint="Permiso como agente aduanero o de carga (opcional si aplica)">
            <input
              className={inputCls}
              placeholder="Ej: LAA-2024-00123"
              value={form.license_number}
              onChange={e => set('license_number', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Representante legal */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Representante legal</p>
        <div className="space-y-3">
          <Field label="Nombre completo" required>
            <input
              className={inputCls}
              placeholder="Nombre completo del representante legal"
              value={form.legal_rep_name}
              onChange={e => set('legal_rep_name', e.target.value)}
            />
          </Field>
          <Field label="Número de identificación" required hint="DUI, Pasaporte, Cédula, etc.">
            <input
              className={inputCls}
              placeholder="Ej: 0801-1985-12345"
              value={form.legal_rep_id}
              onChange={e => set('legal_rep_id', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Declaración jurada */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 accent-[#06B6D4]"
            checked={declared}
            onChange={e => setDeclared(e.target.checked)}
          />
          <p className="text-xs text-slate-600">
            Declaro bajo juramento que la información proporcionada es verdadera y que los documentos
            de mi empresa están vigentes y disponibles para revisión. Entiendo que proporcionar
            información falsa puede resultar en la suspensión permanente de mi cuenta.
          </p>
        </label>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {isPending ? 'Enviando…' : isResubmit ? 'Reenviar para revisión' : 'Enviar para revisión'}
      </button>
    </div>
  )
}
