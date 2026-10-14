import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, leerJson, ok } from '@/lib/horario/http'
import * as v from '@/lib/horario/validate'
import type { EntradaLibro } from '@/lib/horario/libro'
import { CAMPOS, entradasDeHojas, hojasConFilas } from '@/lib/horario/libroDatos'

export const dynamic = 'force-dynamic'

// GET                → filas pendientes de imprimir + últimas hojas + empleados
// GET ?hoja=N        → filas de una hoja impresa (para verla o reimprimirla)
// GET ?empleado=ID   → historial de un colaborador (últimas 200 filas)
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const s = db()
  if (sp.get('hoja')) {
    const n = v.entero(sp.get('hoja'), 'hoja', 1, 1_000_000)
    const [hojas, filas] = await Promise.all([hojasConFilas(s, [n]), entradasDeHojas(s, [n])])
    if (!hojas.length) throw new v.ErrorValidacion('Esa hoja no existe')
    return ok({ hoja: hojas[0], filas })
  }
  if (sp.get('empleado')) {
    const id = v.uuid(sp.get('empleado'), 'empleado')
    const r = await s.from('hr_libro').select(CAMPOS).eq('empleado_id', id).order('numero', { ascending: false }).limit(200)
    dbCheck(r.error)
    return ok({ filas: r.data ?? [] })
  }
  const pend = await s.from('hr_libro').select(CAMPOS).is('hoja', null).order('numero')
  if (pend.error && (['42P01', 'PGRST205'].includes(pend.error.code ?? '') || /does not exist|schema cache/i.test(pend.error.message))) {
    return ok({ instalado: false, pendientes: [], hojas: [], empleados: [] })
  }
  dbCheck(pend.error)
  const [hojas, emps] = await Promise.all([
    hojasConFilas(s),
    s.from('hr_empleados').select('id, nombre, activo').order('orden').order('nombre'),
  ])
  dbCheck(emps.error)
  return ok({
    instalado: true,
    pendientes: pend.data ?? [],
    hojas,
    empleados: (emps.data ?? []).filter(e => e.activo).map(e => ({ id: e.id, nombre: e.nombre })),
  })
})

// Alta a mano o edición de una fila aún sin imprimir
export const POST = handler(async (req: NextRequest) => {
  const o = v.objeto(await leerJson(req))
  const s = db()
  const fecha_peticion = v.fecha(o.fecha_peticion, 'fecha_peticion')
  const detalle = v.textoLineas(o.detalle, 'detalle', 300, 6)

  if (o.id) {
    const id = v.uuid(o.id)
    const prev = await s.from('hr_libro').select('hoja, detalle, detalle_manual').eq('id', id).maybeSingle()
    dbCheck(prev.error)
    if (!prev.data) throw new v.ErrorValidacion('Esa fila ya no existe')
    if (prev.data.hoja != null) throw new v.ErrorValidacion(`Ya está impresa en la hoja ${prev.data.hoja}: añade una fila nueva para corregirla`)
    const manual = prev.data.detalle_manual || detalle !== prev.data.detalle
    const r = await s.from('hr_libro')
      .update({ fecha_peticion, detalle, detalle_manual: manual, updated_at: new Date().toISOString() })
      .eq('id', id).is('hoja', null).select(CAMPOS).maybeSingle()
    dbCheck(r.error)
    if (!r.data) throw new v.ErrorValidacion('Se acaba de imprimir: ya no se puede cambiar')
    return ok({ fila: r.data as EntradaLibro })
  }

  // Nueva fila: colaborador de la plantilla o nombre libre (p. ej. un extra)
  let empleado_id: string | null = null
  let empleado_nombre: string
  if (o.empleado_id) {
    empleado_id = v.uuid(o.empleado_id, 'empleado_id')
    const e = await s.from('hr_empleados').select('nombre').eq('id', empleado_id).maybeSingle()
    dbCheck(e.error)
    if (!e.data) throw new v.ErrorValidacion('Empleado inexistente')
    empleado_nombre = e.data.nombre as string
  } else {
    empleado_nombre = v.texto(o.empleado_nombre, 'colaborador', 60)
  }
  const r = await s.from('hr_libro')
    .insert({ fecha_peticion, empleado_id, empleado_nombre, detalle, detalle_manual: true })
    .select(CAMPOS).single()
  dbCheck(r.error)
  return ok({ fila: r.data as EntradaLibro })
})

// Quitar una fila: solo si aún no está impresa (lo impreso ya está en papel)
export const DELETE = handler(async (req: NextRequest) => {
  const id = v.uuid(req.nextUrl.searchParams.get('id'))
  const r = await db().from('hr_libro').delete().eq('id', id).is('hoja', null).select('id')
  dbCheck(r.error)
  if (!r.data?.length) throw new v.ErrorValidacion('No se puede quitar: ya está impresa o no existe')
  return ok({ ok: true })
})
