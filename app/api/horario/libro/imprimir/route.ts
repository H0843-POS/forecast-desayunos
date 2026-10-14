import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, leerJson, ok } from '@/lib/horario/http'
import * as v from '@/lib/horario/validate'
import { FILAS_HOJA } from '@/lib/horario/libro'
import { entradasDeHojas, hojasConFilas } from '@/lib/horario/libroDatos'

export const dynamic = 'force-dynamic'

// Cierra las filas pendientes en hojas numeradas y las devuelve para el PDF.
// solo_llenas = true → solo hojas completas (la incompleta sigue abierta).
export const POST = handler(async (req: NextRequest) => {
  const o = v.objeto(await leerJson(req))
  const solo_llenas = o.solo_llenas === undefined ? false : v.bool(o.solo_llenas, 'solo_llenas')
  const s = db()
  const r = await s.rpc('hr_libro_imprimir', { p_filas: FILAS_HOJA, p_solo_llenas: solo_llenas })
  dbCheck(r.error)
  const numeros = ((r.data as number[] | null) ?? []).filter(n => Number.isInteger(n))
  if (!numeros.length) throw new v.ErrorValidacion(solo_llenas ? 'Todavía no hay ninguna hoja llena' : 'No hay cambios pendientes de imprimir')
  const [hojas, filas] = await Promise.all([hojasConFilas(s, numeros), entradasDeHojas(s, numeros)])
  return ok({ hojas: hojas.sort((a, b) => a.numero - b.numero), filas })
})
