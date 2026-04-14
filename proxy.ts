// ─────────────────────────────────────────────────────────────────────────────
// PORTERRA V2 — Middleware
// ⛔ Valida JWT en TODAS las rutas protegidas
// ⛔ Bloquea acceso a dashboards si usuario está pending/suspended
// ─────────────────────────────────────────────────────────────────────────────
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole, UserStatus } from '@/types/database.types'

// Rutas públicas que no requieren autenticación
const PUBLIC_PATHS = [
  '/login',
  '/registro',
  '/api/auth',
  '/_next',
  '/favicon.ico',
]

// Prefijo de ruta por rol
const ROLE_PATHS: Record<UserRole, string> = {
  admin:             '/admin',
  freight_forwarder: '/ff',
  carrier:           '/carrier',
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pasar rutas públicas sin validar
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Crear cliente Supabase para el middleware (actualiza cookies de sesión)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.APP_ENV === 'production',
              sameSite: 'strict',
            })
          )
        },
      },
    }
  )

  // Obtener usuario actual (renueva token si es necesario)
  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión → redirigir a login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Leer claims del JWT para obtener rol y status
  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token
    ? JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64').toString())
    : null

  const porterraRole:   UserRole   | undefined = claims?.app_metadata?.porterra_role
  const porterraStatus: UserStatus | undefined = claims?.app_metadata?.porterra_status

  // Usuario pendiente o suspendido → página de estado
  if (porterraStatus === 'pending') {
    if (!pathname.startsWith('/pending')) {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
    return response
  }

  if (porterraStatus === 'suspended') {
    if (!pathname.startsWith('/suspended')) {
      return NextResponse.redirect(new URL('/suspended', request.url))
    }
    return response
  }

  // Validar que el usuario accede solo a rutas de su rol
  if (porterraRole) {
    const allowedPrefix = ROLE_PATHS[porterraRole]

    // Si intenta acceder a ruta de otro rol, redirigir al suyo
    const isAccessingWrongRole = Object.entries(ROLE_PATHS).some(
      ([role, prefix]) =>
        role !== porterraRole && pathname.startsWith(prefix)
    )

    if (isAccessingWrongRole) {
      return NextResponse.redirect(new URL(allowedPrefix, request.url))
    }

    // Si está en raíz, redirigir al dashboard del rol
    if (pathname === '/') {
      return NextResponse.redirect(new URL(allowedPrefix, request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto recursos estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
