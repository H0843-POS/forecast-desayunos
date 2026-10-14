import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, leerJson, ok } from '@/lib/horario/http'
import * as v from '@/lib/horario/validate'

export const dynamic = 'force-dynamic'

// Marcar una hoja impresa como firmada (o deshacerlo)
export const POST = handler(async (req: NextRequest) => {
  const o = v.objeto(await leerJson(req))
  const numero = v.entero(o.numero, 'numero', 1, 1_000_000)
  const firmada = v.bool(o.firmada, 'firmada')
  const r = await db().from('hr_libro_hojas')
    .update({ firmada, firmada_at: firmada ? new Date().toISOString() : null })
    .eq('numero', numero).select('numero')
  dbCheck(r.error)
  if (!r.data?.length) throw new v.ErrorValidacion('Esa hoja no existe')
  return ok({ ok: true })
})
