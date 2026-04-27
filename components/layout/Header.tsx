'use client'

import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from './SidebarContext'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { toggle } = useSidebar()

  return (
    <header className="h-14 border-b border-slate-100 bg-white flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggle}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <h1 className="text-base font-semibold text-[#1A1A2E] leading-none truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notificaciones */}
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell size={16} className="text-slate-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#06B6D4] rounded-full" />
        </Button>
      </div>
    </header>
  )
}
