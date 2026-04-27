'use client'

import { SidebarProvider, useSidebar } from './SidebarContext'
import { Sidebar } from './Sidebar'
import MobileBottomNav from './MobileBottomNav'
import type { UserRole } from '@/types/database.types'

interface Props {
  role: UserRole
  userName: string
  userEmail: string
  children: React.ReactNode
}

function ShellInner({ role, userName, userEmail, children }: Props) {
  const { open, close } = useSidebar()

  return (
    // h-dvh + overflow-hidden keeps the per-page overflow-y-auto scroll containers working
    <div
      className="flex overflow-hidden bg-slate-50"
      style={{ height: '100dvh' }}
    >
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: 'rgba(7,16,28,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={close}
          aria-hidden="true"
        />
      )}

      <Sidebar
        role={role}
        userName={userName}
        userEmail={userEmail}
        mobileOpen={open}
      />

      {/* Main content — push right on desktop, bottom pad on mobile for nav bar */}
      <main
        className="flex-1 flex flex-col overflow-hidden md:ml-64"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* On mobile, reserve space for bottom nav (56px) */}
        <div
          className="flex-1 flex flex-col overflow-hidden md:mb-0"
          style={{ marginBottom: '56px' }}
        >
          <div className="md:hidden" style={{ marginBottom: '-56px' }} />
          {children}
        </div>
      </main>

      <MobileBottomNav role={role} />
    </div>
  )
}

export default function DashboardShell(props: Props) {
  return (
    <SidebarProvider>
      <ShellInner {...props} />
    </SidebarProvider>
  )
}
