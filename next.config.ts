import type { NextConfig } from 'next'

const securityHeaders = [
  // Evita que el sitio sea embebido en iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Evita sniffing de MIME types
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Política de referrer conservadora
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deshabilitar APIs sensibles en el navegador
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS — solo en producción
  ...(process.env.APP_ENV === 'production'
    ? [{
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      }]
    : []),
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval requeridos por Next.js dev — restringir en prod
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.kushki.com`,
      "img-src 'self' data: blob: https://*.supabase.co",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  // Headers de seguridad en todas las respuestas
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // No exponer X-Powered-By
  poweredByHeader: false,

  // Modo estricto de React
  reactStrictMode: true,

  // Imágenes: permitir solo dominios conocidos
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

export default nextConfig
