// Ruta raíz — redirige según rol autenticado
// Si no hay sesión, el middleware redirige a /login antes de llegar aquí
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database.types'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.porterra_role as UserRole | undefined

  const roleRedirect: Record<UserRole, string> = {
    admin:             '/admin',
    freight_forwarder: '/ff',
    carrier:           '/carrier',
  }

  redirect(role ? (roleRedirect[role] ?? '/login') : '/login')
}
