import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/horario/db'
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  createSessionToken,
  passwordMatches,
  sessionConfigOk,
} from '@/lib/horario/session'

export const dynamic = 'force-dynamic'

const MAX_FALLOS = 8
const VENTANA_MIN = 15

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'desconocida').trim().slice(0, 64)
}

export async function POST(req: NextRequest) {
  if (!sessionConfigOk()) {
    return NextResponse.json(
      { error: 'Falta configurar HORARIO_PASSWORD (mín. 8) y HORARIO_SESSION_SECRET (mín. 32) en Vercel' },
      { status: 500 },
    )
  }

  let password = ''
  try {
    const body = await req.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: 'Petición no válida' }, { status: 400 })
  }

  const ip = clientIp(req)
  const desde = new Date(Date.now() - VENTANA_MIN * 60 * 1000).toISOString()
  const { data: fallos } = await db()
    .from('hr_login_intentos')
    .select('id')
    .eq('ip', ip)
    .eq('ok', false)
    .gte('created_at', desde)
  if ((fallos?.length ?? 0) >= MAX_FALLOS) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${VENTANA_MIN} minutos.` },
      { status: 429 },
    )
  }

  const ok = await passwordMatches(password)
  await db().from('hr_login_intentos').insert({ ip, ok })
  // limpieza: no guardar intentos de más de 7 días
  await db().from('hr_login_intentos').delete().lt('created_at', new Date(Date.now() - 7 * 86400 * 1000).toISOString())

  if (!ok) {
    await new Promise(r => setTimeout(r, 700))
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  })
  return res
}
