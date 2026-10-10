import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, ok } from '@/lib/horario/http'
import * as v from '@/lib/horario/validate'

export const dynamic = 'force-dynamic'

// Bolsa de festivos por empleado en un año:
// saldo = saldo inicial + festivos trabajados (turno o formación) − días B
export const GET = handler(async (req: NextRequest) => {
  const anio = v.entero(req.nextUrl.searchParams.get('anio'), 'anio', 2020, 2100)
  const desde = `${anio}-01-01`
  const hasta = `${anio}-12-31`
  const s = db()
  const [emp, fes, asig] = await Promise.all([
    s.from('hr_empleados').select('id, nombre, tipo, saldo_festivos_inicial, activo, orden').order('orden').order('nombre'),
    s.from('hr_festivos').select('fecha, nombre').gte('fecha', desde).lte('fecha', hasta),
    s.from('hr_asignaciones').select('empleado_id, fecha, tipo').gte('fecha', desde).lte('fecha', hasta).in('tipo', ['T', 'FO', 'B']),
  ])
  dbCheck(emp.error); dbCheck(fes.error); dbCheck(asig.error)

  const festivos = new Map((fes.data ?? []).map(f => [f.fecha as string, f.nombre as string]))
  const res = (emp.data ?? [])
    .filter(e => e.tipo === 'plantilla')
    .map(e => {
      const mias = (asig.data ?? []).filter(a => a.empleado_id === e.id)
      const trabajados = mias.filter(a => a.tipo !== 'B' && festivos.has(a.fecha)).map(a => ({ fecha: a.fecha, nombre: festivos.get(a.fecha) }))
      const devueltos = mias.filter(a => a.tipo === 'B').map(a => a.fecha).sort()
      const inicial = Number(e.saldo_festivos_inicial) || 0
      return {
        empleado_id: e.id,
        nombre: e.nombre,
        activo: e.activo,
        inicial,
        trabajados: trabajados.sort((a, b) => a.fecha.localeCompare(b.fecha)),
        devueltos,
        saldo: inicial + trabajados.length - devueltos.length,
      }
    })
  return ok({ anio, empleados: res })
})
