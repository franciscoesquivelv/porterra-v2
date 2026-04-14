'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginAction } from '@/app/actions/auth'

const initialState = { error: '' }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await loginAction(formData)
      return result ?? initialState
    },
    initialState
  )

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1A1A2E]">Iniciar sesión</h2>
        <p className="text-slate-500 mt-1 text-sm">Bienvenido de nuevo a PORTERRA</p>
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email corporativo
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@empresa.com"
            autoComplete="email"
            required
            className="h-11 border-slate-200 focus:border-[#06B6D4] focus:ring-[#06B6D4]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contraseña
            </Label>
            <Link href="/recuperar" className="text-xs text-[#06B6D4] hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="h-11 border-slate-200 focus:border-[#06B6D4] focus:ring-[#06B6D4]"
          />
        </div>

        {state.error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full h-11 bg-[#06B6D4] hover:bg-[#0891b2] text-white font-semibold transition-colors"
        >
          {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </Button>
      </form>

      <div className="mt-6 space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-400">¿Nuevo en PORTERRA?</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/registro?tipo=ff">
            <Button
              variant="outline"
              className="w-full h-10 text-sm border-slate-200 text-slate-600 hover:border-[#06B6D4] hover:text-[#06B6D4]"
            >
              Soy Freight Forwarder
            </Button>
          </Link>
          <Link href="/registro?tipo=carrier">
            <Button
              variant="outline"
              className="w-full h-10 text-sm border-slate-200 text-slate-600 hover:border-[#06B6D4] hover:text-[#06B6D4]"
            >
              Soy Transportista
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
