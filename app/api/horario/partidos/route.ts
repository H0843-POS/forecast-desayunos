import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, ok } from '@/lib/horario/http'
import { sincronizarPartidos } from '@/lib/horario/partidos'

export const dynamic = 'force-dynamic'

// Estado de la última sincronización
export const GET = handler(async (_req: NextRequest) => {
  const { data, error } = await db().from('hr_config').select('valor').eq('clave', 'partidos_sync').maybeSingle()
  dbCheck(error)
  return ok({ ultima: data?.valor ?? null, configurado: !!process.env.FOOTBALL_DATA_TOKEN })
})

// Sincronizar ahora (botón en la app)
export const POST = handler(async (_req: NextRequest) => {
  const r = await sincronizarPartidos()
  return ok(r)
})
