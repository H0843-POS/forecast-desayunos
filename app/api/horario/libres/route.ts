import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, ok } from '@/lib/horario/http'
import * as v from '@/lib/horario/validate'
import { addDays, CONFIG_DEFECTO, lunes, lunesSemanaISO, semanaISO, type ConfigCobertura } from '@/lib/horario/core'

export const dynamic = 'force-dynamic'

// Libres debidos por semana ISO.
// Cada semana completa (los 7 días con algo puesto) le corresponden
// `min_libres_semana` libres. Cuentan los L de esa semana y los L que se
// den más tarde marcados como de esa semana (L40 dado en la semana 42).
// Una semana con 5 o más días de vacaciones/baja no genera libres.
export const GET = handler(async (req: NextRequest) => {
  const anio = v.entero(req.nextUrl.searchParams.get('anio'), 'anio', 2020, 2100)
  const inicio = lunesSemanaISO(anio, 1)
  const ultimo = lunesSemanaISO(anio + 1, 1)
  const s = db()
  const [emp, asig, cfg] = await Promise.all([
    s.from('hr_empleados').select('id, nombre, tipo, activo, orden').order('orden').order('nombre'),
    // hasta 10 semanas después para recoger libres devueltos tarde
    s.from('hr_asignaciones').select('empleado_id, fecha, tipo, libre_de').gte('fecha', inicio).lt('fecha', addDays(ultimo, 70)),
    s.from('hr_config').select('valor').eq('clave', 'cobertura').maybeSingle(),
  ])
  dbCheck(emp.error); dbCheck(asig.error); dbCheck(cfg.error)
  const config: ConfigCobertura = { ...CONFIG_DEFECTO, ...((cfg.data?.valor as Partial<ConfigCobertura>) ?? {}) }
  const req_ = config.min_libres_semana

  type A = { empleado_id: string; fecha: string; tipo: string; libre_de: string | null }
  const porEmp = new Map<string, A[]>()
  for (const a of (asig.data ?? []) as A[]) {
    if (!porEmp.has(a.empleado_id)) porEmp.set(a.empleado_id, [])
    porEmp.get(a.empleado_id)!.push(a)
  }

  const out = (emp.data ?? []).filter(e => e.tipo === 'plantilla').map(e => {
    const lista = porEmp.get(e.id) ?? []
    const diasPorSemana = new Map<string, A[]>()
    const libresDe = new Map<string, number>()
    for (const a of lista) {
      const w = lunes(a.fecha)
      if (!diasPorSemana.has(w)) diasPorSemana.set(w, [])
      diasPorSemana.get(w)!.push(a)
      if (a.tipo === 'L') {
        const de = a.libre_de ?? w
        libresDe.set(de, (libresDe.get(de) ?? 0) + 1)
      }
    }
    const pendientes: { semana: number; lunes: string; faltan: number }[] = []
    for (let w = inicio; w < ultimo; w = addDays(w, 7)) {
      const dias = diasPorSemana.get(w) ?? []
      if (new Set(dias.map(x => x.fecha)).size < 7) continue // semana sin planificar del todo
      if (dias.filter(x => x.tipo === 'V' || x.tipo === 'BJ').length >= 5) continue
      const faltan = req_ - (libresDe.get(w) ?? 0)
      if (faltan > 0) pendientes.push({ semana: semanaISO(w).semana, lunes: w, faltan })
    }
    return {
      empleado_id: e.id,
      nombre: e.nombre,
      activo: e.activo,
      pendientes,
      total: pendientes.reduce((s, p) => s + p.faltan, 0),
    }
  })
  return ok({ anio, libres_por_semana: req_, empleados: out })
})
