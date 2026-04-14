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

const initialState = { error: '' }

function RegisterForm() {
  const params = useSearchParams()
  const tipo = params.get('tipo') ?? 'ff'
  const isFF = tipo === 'ff'

  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const action = isFF ? registerFfAction : registerCarrierAction
      const result = await action(formData)
      return result ?? initialState
    },
    initialState
  )

  return (
    <div>
      {/* Selector de tipo */}
      <div className="mb-8">
        <div className="flex rounded-xl border border-slate-200 p-1 mb-6 bg-slate-50">
          <Link href="/registro?tipo=ff" className="flex-1">
            <button
              type="button"
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                isFF
                  ? 'bg-white text-[#06B6D4] shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Freight Forwarder
            </button>
          </Link>
          <Link href="/registro?tipo=carrier" className="flex-1">
            <button
              type="button"
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                !isFF
                  ? 'bg-white text-[#06B6D4] shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Transportista
            </button>
          </Link>
        </div>

        <h2 className="text-2xl font-bold text-[#1A1A2E]">
          {isFF ? 'Registro de empresa' : 'Registro de transportista'}
        </h2>
        <p className="text-slate-500 mt-1 text-sm">
          {isFF
            ? 'Tu cuenta será revisada antes de ser activada.'
            : 'Empieza a recibir pagos de tus cargas.'}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {/* Nombre completo */}
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-sm font-medium text-slate-700">
              {isFF ? 'Nombre del representante' : 'Nombre completo'}
            </Label>
            <Input
              id="full_name"
              name="full_name"
              placeholder="Juan Pérez"
              required
              className="h-10 border-slate-200 focus:border-[#06B6D4]"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email {isFF ? 'corporativo' : ''}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={isFF ? 'contacto@empresa.com' : 'tu@email.com'}
              required
              className="h-10 border-slate-200 focus:border-[#06B6D4]"
            />
          </div>

          {/* Empresa y RTN solo para FF */}
          {isFF && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="company_name" className="text-sm font-medium text-slate-700">
                  Nombre de la empresa
                </Label>
                <Input
                  id="company_name"
                  name="company_name"
                  placeholder="Freight Services S.A."
                  required
                  className="h-10 border-slate-200 focus:border-[#06B6D4]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tax_id" className="text-sm font-medium text-slate-700">
                  RTN / NIT de la empresa
                </Label>
                <Input
                  id="tax_id"
                  name="tax_id"
                  placeholder="0801-1990-00001"
                  required
                  className="h-10 border-slate-200 focus:border-[#06B6D4]"
                />
              </div>
            </>
          )}

          {/* País */}
          <div className="space-y-1.5">
            <Label
              htmlFor={isFF ? 'company_country' : 'country'}
              className="text-sm font-medium text-slate-700"
            >
              País
            </Label>
            <select
              id={isFF ? 'company_country' : 'country'}
              name={isFF ? 'company_country' : 'country'}
              required
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#06B6D4] focus:border-[#06B6D4]"
            >
              <option value="">Selecciona un país</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
              Teléfono {isFF ? '(opcional)' : ''}
              <span className="text-slate-400 font-normal ml-1">— WhatsApp preferido</span>
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+504 9999-9999"
              required={!isFF}
              className="h-10 border-slate-200 focus:border-[#06B6D4]"
            />
          </div>

          {/* Placa solo para carrier */}
          {!isFF && (
            <div className="space-y-1.5">
              <Label htmlFor="vehicle_plate" className="text-sm font-medium text-slate-700">
                Placa del vehículo <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="vehicle_plate"
                name="vehicle_plate"
                placeholder="HND-1234"
                className="h-10 border-slate-200 focus:border-[#06B6D4]"
              />
            </div>
          )}

          {/* Contraseña */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contraseña
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={isFF ? 'Mín. 10 caracteres' : 'Mín. 8 caracteres'}
              required
              className="h-10 border-slate-200 focus:border-[#06B6D4]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
              Confirmar contraseña
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repite tu contraseña"
              required
              className="h-10 border-slate-200 focus:border-[#06B6D4]"
            />
          </div>
        </div>

        {/* Términos */}
        <div className="flex items-start gap-2 pt-1">
          <input
            type="checkbox"
            id="terms_accepted"
            name="terms_accepted"
            value="true"
            required
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#06B6D4] focus:ring-[#06B6D4]"
          />
          <label htmlFor="terms_accepted" className="text-xs text-slate-500 leading-relaxed">
            Acepto los{' '}
            <Link href="/terminos" className="text-[#06B6D4] hover:underline">
              Términos de Servicio
            </Link>{' '}
            y la{' '}
            <Link href="/privacidad" className="text-[#06B6D4] hover:underline">
              Política de Privacidad
            </Link>{' '}
            de PORTERRA.
          </label>
        </div>

        {state.error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full h-11 bg-[#06B6D4] hover:bg-[#0891b2] text-white font-semibold"
        >
          {pending ? 'Creando cuenta...' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[#06B6D4] hover:underline font-medium">
          Inicia sesión
        </Link>
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
