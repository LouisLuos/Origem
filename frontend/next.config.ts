import type { NextConfig } from 'next'

/**
 * URL do backend usada apenas no servidor (rewrite e renderização no servidor).
 * O navegador chama `/api/v1` no próprio domínio do front, e o Next repassa para cá.
 * Assim o cookie de sessão HttpOnly é de primeira parte e continua SameSite=Lax.
 */
const backendApiUrl = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1'
).replace(/\/+$/, '')

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendApiUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig
