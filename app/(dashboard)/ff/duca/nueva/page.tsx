import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { DucaWizard } from './DucaWizard'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tx?: string; duca?: string }>
}

export default async function NuevaDucaPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params  = await searchParams
  const txId    = params.tx   ?? null
  const ducaId  = params.duca ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Si viene con transacción, precargar datos
  let txData: { reference_number: string | null; cargo_description: string; origin_country: string; destination_country: string } | null = null
  if (txId) {
    const { data } = await db
      .from('transactions')
      .select('reference_number, cargo_description, origin_country, destination_country')
      .eq('id', txId)
      .eq('ff_user_id', user.id)
      .single()
    txData = data
  }

  // Si viene con borrador existente, pre-cargar todos sus campos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let draftData: Record<string, any> | null = null
  if (ducaId) {
    const { data } = await db
      .from('duca_documents')
      .select('*')
      .eq('id', ducaId)
      .eq('ff_user_id', user.id)
      .single()
    draftData = data
    // Si el borrador tiene transacción y no se pasó txId, cargar txData también
    if (data?.transaction_id && !txData) {
      const { data: tx } = await db
        .from('transactions')
        .select('reference_number, cargo_description, origin_country, destination_country')
        .eq('id', data.transaction_id)
        .eq('ff_user_id', user.id)
        .single()
      txData = tx
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={ducaId ? 'Continuar DUCA-T' : 'Nueva DUCA-T'}
        subtitle="Declaración Única Centroamericana · Tránsito Aduanero Internacional Terrestre"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <DucaWizard
          transactionId={txId ?? draftData?.transaction_id ?? null}
          txData={txData}
          existingDucaId={ducaId}
          draftData={draftData}
        />
      </div>
    </div>
  )
}
