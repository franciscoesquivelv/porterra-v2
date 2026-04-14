'use client'

import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-14 border-b border-slate-100 bg-white flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-semibold text-[#1A1A2E] leading-none">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Búsqueda */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar..."
            className="pl-8 h-8 w-52 text-sm border-slate-200 bg-slate-50 focus:bg-white"
          />
        </div>

        {/* Notificaciones */}
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell size={16} className="text-slate-500" />
          {/* Badge de notificaciones no leídas */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#06B6D4] rounded-full" />
        </Button>
      </div>
    </header>
  )
}
