'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database.types'
import {
  LayoutDashboard,
  Users,
  Settings,
  ScrollText,
  FileText,
  TrendingUp,
  Truck,
  DollarSign,
  Star,
  MessageCircle,
  Package,
  Receipt,
  BarChart3,
  ShieldCheck,
  ChevronDown,
  LogOut,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

// ─── NAV CONFIG POR ROL ───────────────────────────────────────────────────────

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
}

type NavSection = {
  section?: string
  items: NavItem[]
}

const NAV_ADMIN: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Usuarios',
    items: [
      { label: 'Gestión de usuarios', href: '/admin/usuarios', icon: Users },
      { label: 'Aprobaciones KYC', href: '/admin/kyc', icon: ShieldCheck, badge: 'nuevo' },
    ],
  },
  {
    section: 'Financiero',
    items: [
      { label: 'Control financiero', href: '/admin/financiero', icon: TrendingUp },
      { label: 'Factoring', href: '/admin/factoring', icon: Receipt },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { label: 'Audit log', href: '/admin/audit', icon: ScrollText },
      { label: 'Configuración', href: '/admin/configuracion', icon: Settings },
    ],
  },
]

const NAV_FF: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/ff', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      { label: 'Transacciones', href: '/ff/transacciones', icon: Package },
      { label: 'Pagos', href: '/ff/pagos', icon: DollarSign },
      { label: 'Documentos DUCA', href: '/ff/duca', icon: FileText },
    ],
  },
  {
    section: 'Red',
    items: [
      { label: 'Transportistas', href: '/ff/transportistas', icon: Truck },
      { label: 'Reportes', href: '/ff/reportes', icon: BarChart3 },
    ],
  },
  {
    section: 'Financiamiento',
    items: [
      { label: 'Factoraje', href: '/ff/factoraje', icon: Receipt },
    ],
  },
]

const NAV_CARRIER: NavSection[] = [
  {
    items: [
      { label: 'Inicio', href: '/carrier', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Mis cobros',
    items: [
      { label: 'Pagos pendientes', href: '/carrier/pagos', icon: DollarSign },
      { label: 'Historial', href: '/carrier/historial', icon: ScrollText },
    ],
  },
  {
    section: 'Oportunidades',
    items: [
      { label: 'Cargas disponibles', href: '/carrier/cargas', icon: Package },
      { label: 'Factoraje rápido', href: '/carrier/factoraje', icon: Receipt },
    ],
  },
  {
    section: 'Mi cuenta',
    items: [
      { label: 'Mi reputación', href: '/carrier/reputacion', icon: Star },
      { label: 'Soporte', href: '/carrier/soporte', icon: MessageCircle },
    ],
  },
]

const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  admin:             NAV_ADMIN,
  freight_forwarder: NAV_FF,
  carrier:           NAV_CARRIER,
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin:             'Administrador',
  freight_forwarder: 'Freight Forwarder',
  carrier:           'Transportista',
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

interface SidebarProps {
  role: UserRole
  userName: string
  userEmail: string
}

export function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const nav = NAV_BY_ROLE[role]

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-[#0F1B2D] text-white shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-[#06B6D4] flex items-center justify-center shrink-0">
          <span className="text-[#0F1B2D] font-black text-sm">P</span>
        </div>
        <div>
          <p className="font-bold text-sm leading-none">PORTERRA</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-none">{ROLE_LABEL[role]}</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {nav.map((section, i) => (
          <div key={i}>
            {section.section && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                {section.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                // Match exacto para el dashboard raíz, prefix para sub-rutas
                const isActive =
                  item.href === `/admin` || item.href === '/ff' || item.href === '/carrier'
                    ? pathname === item.href
                    : pathname.startsWith(item.href)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group',
                        isActive
                          ? 'bg-[#06B6D4]/15 text-[#06B6D4] font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      <Icon
                        size={16}
                        className={cn(
                          'shrink-0 transition-colors',
                          isActive ? 'text-[#06B6D4]' : 'text-slate-500 group-hover:text-slate-300'
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] bg-[#06B6D4]/20 text-[#06B6D4] px-1.5 py-0.5 rounded-full font-medium">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Usuario + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-[#06B6D4]/20 border border-[#06B6D4]/30 flex items-center justify-center shrink-0">
            <span className="text-[#06B6D4] text-sm font-bold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate leading-none">{userName}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{userEmail}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={15} className="shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  )
}
