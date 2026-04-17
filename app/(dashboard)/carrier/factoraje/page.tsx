import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { QuickPayButton } from './QuickPayButton'
import { Receipt, Info, Zap, Shield, Clock, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Split {
  id: string
  split_label: string
  amount_usd: number
  status: string
  due_date: string | null
  created_at: string
  transaction: {
    reference_number: string | null
    origin_country: string
    destination_country: string
    cargo_description: string
  } | null
}

interface QuickPayReq {
  id: string
  split_id: string
  gross_amount_usd: number
  fee_usd: number
  net_amount_usd: number
  status: string
  requested_at: string
  disbursed_at: string | null
}

const PAIS: Record<string, string> = {
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panamá', MX: 'México',
}

export default async function CarrierFactorajePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [{ data: splits }, { data: qpRequests }] = await Promise.all([
    db.from('payment_splits')
      .select(`
        id, split_label, amount_usd, status, due_date, created_at,
        transaction:transactions(reference_number, origin_country, destination_country, cargo_description)
      `)
      .eq('carrier_user_id', user.id)
      .in('status', ['pending', 'processing'])
      .order('due_date', { ascending: true }) as Promise<{ data: Split[] | null }>,

    db.from('quickpay_requests')
      .select('id, split_id, gross_amount_usd, fee_usd, net_amount_usd, status, requested_at, disbursed_at')
      .eq('carrier_user_id', user.id)
      .order('requested_at', { ascending: false }) as Promise<{ data: QuickPayReq[] | null }>,
  ])

  const pending  = splits ?? []
  const requests = qpRequests ?? []
  const qpBySplit = Object.fromEntries(requests.map(r => [r.split_id, r]))

  const eligibleSplits = pending.filter(s => s.status === 'pending')
  const totalEligible  = eligibleSplits.reduce((s, p) => s + Number(p.amount_usd), 0)
  const totalNet       = totalEligible * 0.97

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="QuickPay" subtitle="Cobra tus pagos pendientes hoy mismo" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[#06B6D4]/8 border border-[#06B6D4]/20 rounded-xl px-4 py-3">
          <Info size={15} className="text-[#06B6D4] shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600">
            <strong className="text-[#1A1A2E]">QuickPay</strong> — Recibe el pago de tus cargas hoy,
            sin esperar la fecha de vencimiento. PORTERRA descuenta solo el <strong>3%</strong> como comisión.
            No es un préstamo: es adelantar lo que ya ganaste.
          </p>
        </div>

        {/* Beneficios */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Zap,    title: 'En menos de 24h', desc: 'Desde que solicitas hasta que recibes el dinero', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
            { icon: Shield, title: 'Sin deuda',        desc: 'Es tu dinero anticipado, no un crédito',          color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { icon: Clock,  title: 'Solo 3% de fee',   desc: 'Mucho más barato que cualquier préstamo',          color: 'text-[#06B6D4]', bg: 'bg-cyan-50', border: 'border-cyan-100' },
          ].map(({ icon: Icon, title, desc, color, bg, border }) => (
            <div key={title} className={`${bg} border ${border} rounded-xl p-3`}>
              <Icon size={18} className={`${color} mb-1.5`} />
              <p className="text-xs font-semibold text-[#1A1A2E]">{title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* Resumen elegibilidad */}
        {eligibleSplits.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[#1A1A2E]">
                ${totalEligible.toLocaleString('en', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total elegible</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                ${totalNet.toLocaleString('en', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Recibirías hoy (97%)</p>
            </div>
          </div>
        )}

        {/* Cobros disponibles para QuickPay */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Receipt size={15} className="text-[#06B6D4]" />
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Tus cobros pendientes</h2>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Receipt size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">No tienes cobros pendientes</p>
              <p className="text-xs text-slate-400 mt-1">Aparecerán aquí cuando tengas cargas asignadas</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pending.map(split => {
                const qp = qpBySplit[split.id]
                const tx = split.transaction
                const daysUntilDue = split.due_date
                  ? Math.ceil((new Date(split.due_date).getTime() - Date.now()) / 86400000)
                  : null

                return (
                  <div key={split.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Referencia + ruta */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-slate-400">
                            {tx?.reference_number ?? '—'}
                          </span>
                          {tx && (
                            <span className="text-[10px] text-slate-400">
                              {PAIS[tx.origin_country] ?? tx.origin_country} → {PAIS[tx.destination_country] ?? tx.destination_country}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-[#1A1A2E] truncate">
                          {split.split_label}
                        </p>
                        {tx && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{tx.cargo_description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-lg font-bold text-[#1A1A2E]">
                            ${Number(split.amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                          </span>
                          {daysUntilDue !== null && (
                            <span className={`text-xs ${daysUntilDue <= 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                              vence en {daysUntilDue} día{daysUntilDue !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Acción o estado QuickPay */}
                      <div className="shrink-0">
                        {qp ? (
                          <div className="text-right">
                            {qp.status === 'pending' && (
                              <div>
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 mb-1">
                                  En proceso
                                </Badge>
                                <p className="text-[10px] text-slate-400">
                                  Recibirás ${Number(qp.net_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            )}
                            {qp.status === 'disbursed' && (
                              <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                <CheckCircle size={13} />
                                Desembolsado
                              </div>
                            )}
                            {qp.status === 'rejected' && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                Rechazado
                              </Badge>
                            )}
                          </div>
                        ) : split.status === 'pending' ? (
                          <QuickPayButton
                            splitId={split.id}
                            grossAmount={Number(split.amount_usd)}
                          />
                        ) : (
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-400 border-slate-200">
                            Procesando
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Historial de solicitudes QuickPay */}
        {requests.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-[#1A1A2E]">Historial QuickPay</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {requests.map(req => (
                <div key={req.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E]">
                      ${Number(req.gross_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Fee: ${Number(req.fee_usd).toLocaleString('en', { minimumFractionDigits: 2 })} ·
                      Neto: <span className="text-emerald-600 font-medium">${Number(req.net_amount_usd).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-xs ${
                      req.status === 'disbursed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      req.status === 'rejected'  ? 'bg-red-50 text-red-600 border-red-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {req.status === 'disbursed' ? 'Desembolsado' : req.status === 'rejected' ? 'Rechazado' : 'En proceso'}
                    </Badge>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(req.requested_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
