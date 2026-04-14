import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  change?: number       // porcentaje, positivo = bueno, negativo = malo
  changeLabel?: string  // "vs mes anterior"
  icon?: React.ElementType
  iconColor?: string
  suffix?: string
  className?: string
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = 'vs mes anterior',
  icon: Icon,
  iconColor = '#06B6D4',
  suffix,
  className,
}: KPICardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0
  const isNeutral  = change !== undefined && change === 0

  return (
    <div className={cn(
      'bg-white rounded-xl border border-slate-100 p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow',
      className
    )}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500 font-medium leading-none">{title}</p>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <Icon size={16} style={{ color: iconColor }} />
          </div>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-[#1A1A2E] leading-none">
          {value}
          {suffix && <span className="text-base font-normal text-slate-400 ml-1">{suffix}</span>}
        </p>
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-slate-400'
          )}>
            {isPositive ? (
              <TrendingUp size={12} />
            ) : isNegative ? (
              <TrendingDown size={12} />
            ) : (
              <Minus size={12} />
            )}
            <span>
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </span>
          </div>
          <span className="text-xs text-slate-400">{changeLabel}</span>
        </div>
      )}
    </div>
  )
}
