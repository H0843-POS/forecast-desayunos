import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/horario/session'

// Protege todo el módulo Horario (páginas y API) con la contraseña.
// El resto de la app (forecast, prefacturación, stock) no pasa por aquí.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/horario/login') return NextResponse.next()

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (ok) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/horario/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/horario', '/horario/:path*', '/api/horario', '/api/horario/:path*'],
}
