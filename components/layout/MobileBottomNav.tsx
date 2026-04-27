'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, DollarSign, FileText,
  Star, ShieldCheck, Users, Menu, Boxes,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import type { UserRole } from '@/types/database.types'

type NavTab = {
  label: string
  href?: string
  icon: React.ElementType
  action?: 'sidebar'
  match?: string[]
}

const TABS_FF: NavTab[] = [
  { label: 'Inicio',     href: '/ff',               icon: LayoutDashboard },
  { label: 'Cargas',     href: '/ff/transacciones',  icon: Package,        match: ['/ff/transacciones'] },
  { label: 'Pagos',      href: '/ff/pagos',          icon: DollarSign },
  { label: 'DUCA',       href: '/ff/duca',           icon: FileText },
  { label: 'Más',        action: 'sidebar',          icon: Menu },
]

const TABS_CARRIER: NavTab[] = [
  { label: 'Inicio',     href: '/carrier',           icon: LayoutDashboard },
  { label: 'Pagos',      href: '/carrier/pagos',     icon: DollarSign },
  { label: 'Cargas',     href: '/carrier/cargas',    icon: Boxes },
  { label: 'Reputación', href: '/carrier/reputacion',icon: Star },
  { label: 'Más',        action: 'sidebar',          icon: Menu },
]

const TABS_ADMIN: NavTab[] = [
  { label: 'Dashboard',  href: '/admin',             icon: LayoutDashboard },
  { label: 'KYC',        href: '/admin/kyc',         icon: ShieldCheck },
  { label: 'Cargas',     href: '/admin/cargas',      icon: Boxes },
  { label: 'Usuarios',   href: '/admin/usuarios',    icon: Users },
  { label: 'Más',        action: 'sidebar',          icon: Menu },
]

const TABS_BY_ROLE: Record<UserRole, NavTab[]> = {
  admin:             TABS_ADMIN,
  freight_forwarder: TABS_FF,
  carrier:           TABS_CARRIER,
}

export default function MobileBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const { open, toggle } = useSidebar()
  const tabs = TABS_BY_ROLE[role] ?? TABS_FF

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        backgroundColor: '#0F1B2D',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch h-14">
        {tabs.map(tab => {
          const Icon = tab.icon

          if (tab.action === 'sidebar') {
            return (
              <button
                key="mas"
                onClick={toggle}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
                style={{ color: open ? '#06B6D4' : 'rgba(148,163,184,0.7)' }}
              >
                {/* Active indicator */}
                <span
                  style={{
                    display: 'block',
                    height: 2,
                    width: 20,
                    borderRadius: 1,
                    backgroundColor: open ? '#06B6D4' : 'transparent',
                    marginBottom: 4,
                    transition: 'background-color 0.15s',
                  }}
                />
                <Icon size={19} strokeWidth={open ? 2.2 : 1.8} />
                <span>{tab.label}</span>
              </button>
            )
          }

          const isActive = tab.href === '/ff' || tab.href === '/carrier' || tab.href === '/admin'
            ? pathname === tab.href
            : tab.href ? pathname.startsWith(tab.href) : false

          return (
            <Link
              key={tab.href}
              href={tab.href!}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
              style={{ color: isActive ? '#06B6D4' : 'rgba(148,163,184,0.7)' }}
            >
              <span
                style={{
                  display: 'block',
                  height: 2,
                  width: 20,
                  borderRadius: 1,
                  backgroundColor: isActive ? '#06B6D4' : 'transparent',
                  marginBottom: 4,
                  transition: 'background-color 0.15s',
                }}
              />
              <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
