'use client'

import { useActionState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerFfAction, registerCarrierAction } from '@/app/actions/auth'

const COUNTRIES = [
  { value: 'GT', label: 'Guatemala' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'HN', label: 'Honduras' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'PA', label: 'Panamá' },
  { value: 'MX', label: 'México' },
]

type FormState = {
  error: string
  fieldErrors: Record<string, string>
  fields: Record<string, string>
}

const initialState: FormState = { error: '', fieldErrors: {}, fields: {} }

// Helper: muestra error de campo con estilos
function FieldError({ error }: { error?: string }) {
  if (!error) return null
  return <p className="text-xs text-red-500 mt-1">{error}</p>
}

// Helper: clase de borde con error
function inputClass(error?: string) {
  return `h-10 ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : 'border-slate-200 focus:border-[#06B6D4]'}`
}

function RegisterForm() {
  const params = useSearchParams()
  const tipo = params.get('tipo') ?? 'ff'
  const isFF = tipo === 'ff'

  const [state, formAction, pending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const action = isFF ? registerFfAction : registerCarrierAction
      const result = await action(formData)
      return result ?? initialState
    },
    initialState
  )

  const fe = state.fieldErrors
  const f  = state.fields

  return (
    <div>
      {/* Selector de tipo */}
      <div className="mb-8">
        <div className="flex rounded-xl border border-slate-200 p-1 mb-6 bg-slate-50">
          <Link href="/registro?tipo=ff" className="flex-1">
            <button type="button" className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${isFF ? 'bg-white text-[#06B6D4] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
              Freight Forwarder
            </button>
          </Link>
          <Link href="/registro?tipo=carrier" className="flex-1">
            <button type="button" className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${!isFF ? 'bg-white text-[#06B6D4] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
              Transportista
            </button>
          </Link>
        </div>

        <h2 className="text-2xl font-bold text-[#1A1A2E]">
          {isFF ? 'Registro de empresa' : 'Registro de transportista'}
        </h2>
        <p className="text-slate-500 mt-1 text-sm">
          {isFF ? 'Tu cuenta será revisada antes de ser activada.' : 'Empieza a recibir pagos de tus cargas.'}
        </p>
      </div>

      <form action={formAction} className="space-y-4">

        {/* Nombre completo */}
        <div className="space-y-1.5">
          <Label htmlFor="full_name" className="text-sm font-medium text-slate-700">
            {isFF ? 'Nombre del representante' : 'Nombre completo'}
          </Label>
          <Input
            id="full_name" name="full_name" placeholder="Juan Pérez" required
            defaultValue={f.full_name}
            className={inputClass(fe.full_name)}
          />
          <FieldError error={fe.full_name} />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email {isFF ? 'corporativo' : ''}
          </Label>
          <Input
            id="email" name="email" type="email"
            placeholder={isFF ? 'contacto@empresa.com' : 'tu@email.com'} required
            defaultValue={f.email}
            className={inputClass(fe.email)}
          />
          <FieldError error={fe.email} />
        </div>

        {/* FF: empresa + RTN */}
        {isFF && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="company_name" className="text-sm font-medium text-slate-700">Nombre de la empresa</Label>
              <Input
                id="company_name" name="company_name" placeholder="Freight Services S.A." required
                defaultValue={f.company_name}
                className={inputClass(fe.company_name)}
              />
              <FieldError error={fe.company_name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax_id" className="text-sm font-medium text-slate-700">RTN / NIT de la empresa</Label>
              <Input
                id="tax_id" name="tax_id" placeholder="0801-1990-00001" required
                defaultValue={f.tax_id}
                className={inputClass(fe.tax_id)}
              />
              <FieldError error={fe.tax_id} />
            </div>
          </>
        )}

        {/* País */}
        <div className="space-y-1.5">
          <Label htmlFor={isFF ? 'company_country' : 'country'} className="text-sm font-medium text-slate-700">País</Label>
          <select
            id={isFF ? 'company_country' : 'country'}
            name={isFF ? 'company_country' : 'country'}
            required
            defaultValue={f[isFF ? 'company_country' : 'country'] ?? ''}
            className={`w-full h-10 px-3 rounded-md border bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 ${fe[isFF ? 'company_country' : 'country'] ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#06B6D4] focus:border-[#06B6D4]'}`}
          >
            <option value="">Selecciona un país</option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <FieldError error={fe[isFF ? 'company_country' : 'country']} />
        </div>

        {/* Teléfono */}
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
            Teléfono {isFF ? '(opcional)' : ''}<span className="text-slate-400 font-normal ml-1">— WhatsApp preferido</span>
          </Label>
          <Input
            id="phone" name="phone" type="tel" placeholder="+504 9999-9999"
            required={!isFF}
            defaultValue={f.phone}
            className={inputClass(fe.phone)}
          />
          <FieldError error={fe.phone} />
        </div>

        {/* Carrier: placa */}
        {!isFF && (
          <div className="space-y-1.5">
            <Label htmlFor="vehicle_plate" className="text-sm font-medium text-slate-700">
              Placa del vehículo <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              id="vehicle_plate" name="vehicle_plate" placeholder="HND-1234"
              defaultValue={f.vehicle_plate}
              className={inputClass(fe.vehicle_plate)}
            />
            <FieldError error={fe.vehicle_plate} />
          </div>
        )}

        {/* Contraseña */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</Label>
          <Input
            id="password" name="password" type="password"
            placeholder={isFF ? 'Mín. 10 caracteres' : 'Mín. 8 caracteres'} required
            className={inputClass(fe.password)}
          />
          <FieldError error={fe.password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">Confirmar contraseña</Label>
          <Input
            id="confirmPassword" name="confirmPassword" type="password"
            placeholder="Repite tu contraseña" required
            className={inputClass(fe.confirmPassword)}
          />
          <FieldError error={fe.confirmPassword} />
        </div>

        {/* Términos */}
        <div className="flex items-start gap-2 pt-1">
          <input
            type="checkbox" id="terms_accepted" name="terms_accepted" value="true" required
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#06B6D4] focus:ring-[#06B6D4]"
          />
          <label htmlFor="terms_accepted" className="text-xs text-slate-500 leading-relaxed">
            Acepto los{' '}
            <Link href="/terminos" className="text-[#06B6D4] hover:underline">Términos de Servicio</Link>
            {' '}y la{' '}
            <Link href="/privacidad" className="text-[#06B6D4] hover:underline">Política de Privacidad</Link>
            {' '}de PORTERRA.
          </label>
        </div>
        <FieldError error={fe.terms_accepted} />

        {/* Error general */}
        {state.error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <Button
          type="submit" disabled={pending}
          className="w-full h-11 bg-[#06B6D4] hover:bg-[#0891b2] text-white font-semibold"
        >
          {pending ? 'Creando cuenta...' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#06B6D4] hover:underline font-medium">Inicia sesión</Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 bg-slate-100 rounded-xl" />}>
      <RegisterForm />
    </Suspense>
  )
}
