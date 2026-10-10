import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, leerJson, ok } from '@/lib/horario/http'
import * as v from '@/lib/horario/validate'
import { describir, turnosMap, type Asignacion, type TipoAsig, type Turno } from '@/lib/horario/core'

export const dynamic = 'force-dynamic'

const TIPOS: readonly TipoAsig[] = ['T', 'L', 'V', 'BJ', 'FO', 'B']

// Cada item fija lo que tiene un empleado un día. tipo = null borra la celda.
// Si el mes ya está publicado, el cambio queda en el historial de ajustes.
function parseItem(raw: unknown): { empleado_id: string; fecha: string; fila: Asignacion | null } {
  const o = v.objeto(raw, 'item')
  const empleado_id = v.uuid(o.empleado_id, 'empleado_id')
  const fecha = v.fecha(o.fecha)
  const tipo = v.unoOpt(o.tipo, 'tipo', TIPOS)
  if (!tipo) return { empleado_id, fecha, fila: null }

  const fila: Asignacion = {
    empleado_id, fecha, tipo,
    turno: null, inicio: null, fin: null, inicio2: null, fin2: null, horas: null,
    nota: v.textoOpt(o.nota, 'nota', 200),
  }
  if (tipo === 'T') {
    fila.turno = o.turno ? v.codigo(o.turno, 'turno') : null
    fila.inicio = v.horaOpt(o.inicio, 'inicio')
    fila.fin = v.horaOpt(o.fin, 'fin')
    fila.inicio2 = v.horaOpt(o.inicio2, 'inicio2')
    fila.fin2 = v.horaOpt(o.fin2, 'fin2')
    if ((fila.inicio == null) !== (fila.fin == null)) throw new v.ErrorValidacion('Indica inicio y fin del horario')
    if ((fila.inicio2 == null) !== (fila.fin2 == null)) throw new v.ErrorValidacion('Indica inicio y fin del segundo tramo')
    if (!fila.turno && !fila.inicio) throw new v.ErrorValidacion('Falta el turno o el horario')
  }
  if (tipo === 'FO') fila.horas = v.numeroOpt(o.horas, 'horas', 0, 14)
  return { empleado_id, fecha, fila }
}

export const POST = handler(async (req: NextRequest) => {
  const body = v.objeto(await leerJson(req))
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 600) {
    throw new v.ErrorValidacion('items no válido (1-600)')
  }
  const items = body.items.map(parseItem)
  const s = db()

  const empIds = Array.from(new Set(items.map(i => i.empleado_id)))
  const fechas = Array.from(new Set(items.map(i => i.fecha))).sort()
  const [prev, emps, turnosRes, meses] = await Promise.all([
    s.from('hr_asignaciones').select('*').in('empleado_id', empIds).gte('fecha', fechas[0]).lte('fecha', fechas[fechas.length - 1]),
    s.from('hr_empleados').select('id, nombre').in('id', empIds),
    s.from('hr_turnos').select('*'),
    s.from('hr_meses').select('mes'),
  ])
  dbCheck(prev.error); dbCheck(emps.error); dbCheck(turnosRes.error); dbCheck(meses.error)

  const nombres = new Map((emps.data ?? []).map(e => [e.id as string, e.nombre as string]))
  if (nombres.size !== empIds.length) throw new v.ErrorValidacion('Empleado inexistente')
  const tm = turnosMap((turnosRes.data ?? []).map((t: Turno) => ({ ...t, inicio: t.inicio.slice(0, 5), fin: t.fin.slice(0, 5) })))
  for (const i of items) {
    if (i.fila?.turno && !tm.has(i.fila.turno)) throw new v.ErrorValidacion(`Turno inexistente: ${i.fila.turno}`)
  }
  const publicados = new Set((meses.data ?? []).map(m => (m.mes as string).slice(0, 7)))
  const anterior = new Map<string, Asignacion>()
  for (const a of prev.data ?? []) {
    anterior.set(`${a.empleado_id}|${a.fecha}`, {
      ...a,
      inicio: a.inicio?.slice(0, 5) ?? null, fin: a.fin?.slice(0, 5) ?? null,
      inicio2: a.inicio2?.slice(0, 5) ?? null, fin2: a.fin2?.slice(0, 5) ?? null,
      horas: a.horas == null ? null : Number(a.horas),
    })
  }

  // si el mismo empleado/día viene repetido, gana el último
  const ultimo = new Map<string, (typeof items)[number]>()
  for (const i of items) ultimo.set(`${i.empleado_id}|${i.fecha}`, i)

  const upserts: Asignacion[] = []
  const borrar: { empleado_id: string; fecha: string }[] = []
  const ajustes: { fecha: string; empleado_id: string; empleado_nombre: string; antes: string; despues: string }[] = []

  ultimo.forEach((i, k) => {
    const antes = describir(anterior.get(k), tm)
    const despues = describir(i.fila, tm)
    if (i.fila) upserts.push({ ...i.fila, updated_at: new Date().toISOString() } as Asignacion)
    else if (anterior.has(k)) borrar.push({ empleado_id: i.empleado_id, fecha: i.fecha })
    if (publicados.has(i.fecha.slice(0, 7)) && antes !== despues) {
      ajustes.push({ fecha: i.fecha, empleado_id: i.empleado_id, empleado_nombre: nombres.get(i.empleado_id)!, antes, despues })
    }
  })

  if (upserts.length) {
    const r = await s.from('hr_asignaciones').upsert(upserts, { onConflict: 'empleado_id,fecha' })
    dbCheck(r.error)
  }
  for (const b of borrar) {
    const r = await s.from('hr_asignaciones').delete().eq('empleado_id', b.empleado_id).eq('fecha', b.fecha)
    dbCheck(r.error)
  }
  if (ajustes.length) {
    const r = await s.from('hr_ajustes').insert(ajustes)
    dbCheck(r.error)
  }
  return ok({ ok: true, guardadas: upserts.length, borradas: borrar.length, ajustes: ajustes.length })
})
