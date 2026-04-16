'use client'

import { useState, useTransition } from 'react'
import { updateConfigAction } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Check } from 'lucide-react'

interface ConfigMeta {
  label: string
  hint: string
  suffix: string
  type: 'percent' | 'usd' | 'bool'
}

interface ConfigItem {
  key: string
  value: string
  description: string | null
  updated_at: string
  meta: ConfigMeta
}

interface Props {
  configs: ConfigItem[]
  adminUserId: string
}

export function ConfigEditor({ configs }: Props) {
  const [values, setValues]   = useState<Record<string, string>>(
    Object.fromEntries(configs.map(c => [c.key, c.value]))
  )
  const [saved,  setSaved]    = useState<Record<string, boolean>>({})
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function handleChange(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }))
    setSaved(s  => ({ ...s, [key]: false }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  function handleSave(key: string) {
    startTransition(async () => {
      const result = await updateConfigAction(key, values[key])
      if (result?.error) {
        setErrors(e => ({ ...e, [key]: result.error! }))
      } else {
        setSaved(s => ({ ...s, [key]: true }))
        setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2500)
      }
    })
  }

  return (
    <div className="space-y-3">
      {configs.map((cfg) => {
        const val    = values[cfg.key]
        const isBool = cfg.meta.type === 'bool'
        const dirty  = val !== cfg.value
        const ok     = saved[cfg.key]
        const err    = errors[cfg.key]

        return (
          <div key={cfg.key} className="bg-white border border-slate-100 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1A1A2E]">{cfg.meta.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{cfg.meta.hint}</p>

                <div className="mt-3">
                  {isBool ? (
                    /* Toggle */
                    <button
                      type="button"
                      onClick={() => handleChange(cfg.key, val === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        val === 'true' ? 'bg-[#06B6D4]' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        val === 'true' ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  ) : (
                    /* Number input */
                    <div className="flex items-center gap-2 max-w-[220px]">
                      <input
                        type="number"
                        step={cfg.meta.type === 'percent' ? '0.01' : '1'}
                        min="0"
                        value={val}
                        onChange={e => handleChange(cfg.key, e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-mono text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                      />
                      {cfg.meta.suffix && (
                        <span className="text-xs font-medium text-slate-400 shrink-0">{cfg.meta.suffix}</span>
                      )}
                    </div>
                  )}
                </div>

                {err && <p className="text-xs text-red-500 mt-1.5">{err}</p>}
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Button
                  size="sm"
                  disabled={(!dirty && !isBool) || isPending}
                  onClick={() => handleSave(cfg.key)}
                  className={`h-8 px-3 text-xs gap-1.5 transition-all ${
                    ok
                      ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                      : 'bg-[#0F1B2D] hover:bg-[#0F1B2D]/80 text-white'
                  } disabled:opacity-30`}
                >
                  {isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : ok ? (
                    <><Check size={12} /> Guardado</>
                  ) : (
                    <><Save size={12} /> Guardar</>
                  )}
                </Button>
                <span className="text-[10px] text-slate-300">
                  {new Date(cfg.updated_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
