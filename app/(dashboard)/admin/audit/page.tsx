import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollText } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface AuditRow {
  id: string
  created_at: string
  actor_role: string
  actor_ip: string | null
  event_type: string
  entity_type: string | null
  entity_id: string | null
  checksum: string
  metadata: Record<string, unknown> | null
}

const ROLE_COLOR: Record<string, string> = {
  admin:             'text-violet-700 bg-violet-50',
  freight_forwarder: 'text-blue-700 bg-blue-50',
  carrier:           'text-cyan-700 bg-cyan-50',
}

interface PageProps {
  searchParams: Promise<{ q?: string; categoria?: string }>
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params   = await searchParams
  const search   = params.q?.toLowerCase() ?? ''
  const category = params.categoria ?? 'todos'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any
  let query = admin
    .from('audit_log')
    .select('id, created_at, actor_role, actor_ip, event_type, entity_type, entity_id, checksum, metadata')
    .order('created_at', { ascending: false })
    .limit(200)

  if (category !== 'todos') query = query.ilike('event_type', `${category}.%`)

  const { data: logs } = await query as { data: AuditRow[] | null }
  const filtered = (logs ?? []).filter(l =>
    !search || l.event_type.includes(search) || (l.entity_id ?? '').includes(search)
  )

  const categories = [
    { value: 'todos', label: 'Todos' },
    { value: 'auth', label: 'Auth' },
    { value: 'user', label: 'Usuarios' },
    { value: 'admin', label: 'Admin' },
    { value: 'transaction', label: 'Transacciones' },
    { value: 'payment', label: 'Pagos' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Audit Log" subtitle={`${filtered.length} eventos · inmutable · SHA-256`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {categories.map(({ value, label }) => (
              <Link key={value} href={`/admin/audit?categoria=${value}${search ? `&q=${search}` : ''}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${category === value ? 'bg-[#0F1B2D] text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                {label}
              </Link>
            ))}
          </div>
          <form method="GET" action="/admin/audit" className="ml-auto">
            <input type="hidden" name="categoria" value={category} />
            <input name="q" defaultValue={search} placeholder="Buscar evento o ID..."
              className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]" />
          </form>
        </div>

        {/* Info seguridad */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <ScrollText size={14} className="text-slate-500 shrink-0" />
          <p className="text-xs text-slate-500">
            Cada evento tiene un checksum SHA-256 para detectar cualquier modificación. Este log es <strong>inmutable</strong> — ningún rol puede editar ni eliminar registros.
          </p>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-500">Fecha</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Evento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Rol</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">IP</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Entidad</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500">Checksum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center text-sm text-slate-400">
                    No hay eventos que coincidan
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/40">
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap py-2.5">
                      {new Date(log.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-slate-700">{log.event_type}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[log.actor_role] ?? 'text-slate-600 bg-slate-100'}`}>
                        {log.actor_role}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{log.actor_ip ?? '—'}</TableCell>
                    <TableCell>
                      {log.entity_id ? (
                        <span className="font-mono text-xs text-slate-500">{log.entity_type}/{log.entity_id.substring(0, 8)}…</span>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px] text-slate-300">{log.checksum.substring(0, 12)}…</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
