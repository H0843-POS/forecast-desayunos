// Alta automática en el libro de cambios cuando se toca un turno de un mes publicado.
// Solo servidor.
import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_CAMBIOS_FILA, MINUTOS_AGRUPAR, hoyMadrid, textoCambios, type CambioLibro } from './libro'

export interface CambioTurno {
  empleado_id: string
  empleado_nombre: string
  fecha: string
  /** texto corto (M8, L42, Vacaciones…) */
  antes: string
  despues: string
}

/**
 * Apunta los cambios en el libro. Agrupa por colaborador: si ya tiene una fila
 * sin imprimir tocada hace menos de MINUTOS_AGRUPAR, el cambio se suma a esa fila.
 * Devuelve, por empleado, el id de la fila del libro donde ha quedado.
 */
export async function registrarEnLibro(s: SupabaseClient, cambios: CambioTurno[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!cambios.length) return out

  // Intercambios: mismo día, A pasa a tener lo de B y B lo de A
  const con = new Map<string, string>()
  for (const a of cambios) {
    const b = cambios.find(x => x !== a && x.fecha === a.fecha && x.antes === a.despues && x.despues === a.antes)
    if (b) con.set(`${a.empleado_id}|${a.fecha}`, b.empleado_nombre)
  }

  const porEmpleado = new Map<string, CambioTurno[]>()
  for (const c of cambios) porEmpleado.set(c.empleado_id, [...(porEmpleado.get(c.empleado_id) ?? []), c])

  const limite = new Date(Date.now() - MINUTOS_AGRUPAR * 60 * 1000).toISOString()
  const { data: abiertas, error } = await s.from('hr_libro')
    .select('id, empleado_id, cambios')
    .is('hoja', null).eq('detalle_manual', false)
    .in('empleado_id', Array.from(porEmpleado.keys()))
    .gte('updated_at', limite)
    .order('numero', { ascending: false })
  if (error) throw new Error(error.message)

  for (const [empId, lista] of Array.from(porEmpleado.entries())) {
    const nuevos: CambioLibro[] = lista.map(c => {
      const x: CambioLibro = { fecha: c.fecha, antes: c.antes, despues: c.despues }
      const otro = con.get(`${empId}|${c.fecha}`)
      if (otro) x.con = otro
      return x
    })
    const fila = (abiertas ?? []).find(a => a.empleado_id === empId)
    const previos = (fila?.cambios as CambioLibro[] | undefined) ?? []

    // Fusionar: si el mismo día ya estaba, se conserva el "antes" original
    const fusion = previos.map(p => ({ ...p }))
    for (const n of nuevos) {
      const i = fusion.findIndex(p => p.fecha === n.fecha)
      if (i >= 0) {
        fusion[i] = { fecha: n.fecha, antes: fusion[i].antes, despues: n.despues }
        if (n.con) fusion[i].con = n.con
      }
      else fusion.push(n)
    }
    // Si se ha deshecho (vuelve a lo de antes), deja de ser un cambio
    const limpio = fusion.filter(c => c.antes !== c.despues)

    if (fila && limpio.length <= MAX_CAMBIOS_FILA) {
      if (limpio.length === 0) {
        const r = await s.from('hr_libro').delete().eq('id', fila.id).is('hoja', null)
        if (r.error) throw new Error(r.error.message)
        continue
      }
      const r = await s.from('hr_libro')
        .update({ cambios: limpio, detalle: textoCambios(limpio), updated_at: new Date().toISOString() })
        .eq('id', fila.id).is('hoja', null)
      if (r.error) throw new Error(r.error.message)
      out.set(empId, fila.id as string)
      continue
    }

    const solo = nuevos.filter(c => c.antes !== c.despues)
    if (!solo.length) continue
    // trocear por si alguien cambia muchos días de golpe
    for (let i = 0; i < solo.length; i += MAX_CAMBIOS_FILA) {
      const trozo = solo.slice(i, i + MAX_CAMBIOS_FILA)
      const r = await s.from('hr_libro').insert({
        fecha_peticion: hoyMadrid(),
        empleado_id: empId,
        empleado_nombre: lista[0].empleado_nombre,
        cambios: trozo,
        detalle: textoCambios(trozo),
      }).select('id').single()
      if (r.error) throw new Error(r.error.message)
      out.set(empId, r.data.id as string)
    }
  }
  return out
}
