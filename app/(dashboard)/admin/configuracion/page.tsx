import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { ConfigEditor } from './ConfigEditor'

export const dynamic = 'force-dynamic'

interface ConfigRow { key: string; value: string; description: string | null; updated_at: string }

const CONFIG_META: Record<string, { label: string; hint: string; suffix: string; type: 'percent' | 'usd' | 'bool' }> = {
  take_rate_pct:           { label: 'Take rate',               hint: 'Porcentaje que PORTERRA cobra sobre cada transacción',            suffix: '%',  type: 'percent' },
  factoring_discount_rate: { label: 'Tasa de descuento factoring', hint: 'Descuento aplicado al adelantar facturas al FF',              suffix: '%',  type: 'percent' },
  max_transaction_usd:     { label: 'Monto máximo por transacción', hint: 'Límite de monto en USD por operación individual',            suffix: 'USD', type: 'usd' },
  kyc_auto_approve:        { label: 'KYC automático',           hint: 'Solo para entornos de desarrollo. Nunca activar en producción.', suffix: '',   type: 'bool' },
}

export default async function AdminConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any
  const { data } = await admin
    .from('platform_config')
    .select('key, value, description, updated_at')
    .order('key') as { data: ConfigRow[] | null }

  const configs = (data ?? []).map(c => ({
    ...c,
    meta: CONFIG_META[c.key] ?? { label: c.key, hint: c.description ?? '', suffix: '', type: 'usd' as const },
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Configuración" subtitle="Parámetros de la plataforma" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            ⚠️ Cambios aquí afectan todas las transacciones nuevas en tiempo real. Procede con cuidado.
          </div>
          <ConfigEditor configs={configs} adminUserId={user.id} />
        </div>
      </div>
    </div>
  )
}
