import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, leerJson, ok } from '@/lib/horario/http'
import { RECURSOS } from '@/lib/horario/recursos'
import * as v from '@/lib/horario/validate'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ recurso: string }> }

async function recurso(ctx: Ctx) {
  const { recurso } = await ctx.params
  const r = Object.prototype.hasOwnProperty.call(RECURSOS, recurso) ? RECURSOS[recurso] : undefined
  if (!r) throw new v.ErrorValidacion('Recurso desconocido')
  return r
}

// Listado de festivos de un año completo (?anio=2026); el resto se lee por /datos
export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const { recurso } = await ctx.params
  if (recurso !== 'festivos') throw new v.ErrorValidacion('Solo se pueden listar festivos')
  const anio = v.entero(req.nextUrl.searchParams.get('anio'), 'anio', 2020, 2100)
  const { data, error } = await db().from('hr_festivos').select('*')
    .gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`).order('fecha')
  dbCheck(error)
  return ok(data)
})

// Alta o edición (upsert por clave)
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  const r = await recurso(ctx)
  const fila = r.parse(v.objeto(await leerJson(req)))
  const q = db().from(r.tabla).upsert(fila, { onConflict: r.clave }).select().single()
  const { data, error } = await q
  dbCheck(error)
  return ok(data)
})

// Borrado: ?id=... (o ?fecha= / ?codigo= / ?mes= según el recurso)
export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  const r = await recurso(ctx)
  if (!r.borrable) throw new v.ErrorValidacion('Este recurso no se puede borrar')
  const valor = r.parseClave(req.nextUrl.searchParams.get(r.clave))
  const q = r.borradoSuave
    ? db().from(r.tabla).update({ activo: false }).eq(r.clave, valor)
    : db().from(r.tabla).delete().eq(r.clave, valor)
  const { error } = await q
  dbCheck(error)
  return ok()
})
