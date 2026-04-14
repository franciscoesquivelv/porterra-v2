import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import type { UserRole } from '@/types/database.types'

interface ProfileRow {
  pii_full_name: string
  porterra_role: string
  porterra_status: string
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('pii_full_name, porterra_role, porterra_status')
    .eq('user_id', user.id)
    .single() as { data: ProfileRow | null }

  if (!profile) redirect('/login')

  if (profile.porterra_status === 'pending')   redirect('/pending')
  if (profile.porterra_status === 'suspended') redirect('/suspended')

  const role = profile.porterra_role as UserRole

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        role={role}
        userName={profile.pii_full_name}
        userEmail={user.email ?? ''}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
