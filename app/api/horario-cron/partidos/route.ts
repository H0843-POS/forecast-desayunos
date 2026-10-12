import { NextRequest, NextResponse } from 'next/server'
import { sincronizarPartidos } from '@/lib/horario/partidos'

export const dynamic = 'force-dynamic'

// Lo llama Vercel Cron una vez al día (vercel.json). Vercel manda
// "Authorization: Bearer <CRON_SECRET>"; sin ese secreto no se ejecuta.
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const h = req.headers.get('authorization') ?? ''
  const esperado = `Bearer ${secret}`
  if (h.length !== esperado.length) return false
  let diff = 0
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ esperado.charCodeAt(i)
  return diff === 0
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    return NextResponse.json(await sincronizarPartidos())
  } catch (e) {
    console.error('[horario-cron]', e)
    return NextResponse.json({ error: 'Error al sincronizar' }, { status: 500 })
  }
}
