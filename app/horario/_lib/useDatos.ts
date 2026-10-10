'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/horario/client'
import {
  avisosEmpleado,
  cobertura,
  indexAsignaciones,
  rangoFechas,
  turnosMap,
  type Asignacion,
  type Aviso,
  type Cobertura,
  type DatosHorario,
} from '@/lib/horario/core'

export type AsigInput = Partial<Omit<Asignacion, 'tipo'>> & { empleado_id: string; fecha: string; tipo: Asignacion['tipo'] | null }

/**
 * Carga todos los datos de un rango y calcula cobertura y avisos.
 * `visibleDesde/visibleHasta` es lo que se muestra; el rango cargado se
 * amplía una semana por cada lado para poder evaluar descansos y semanas.
 */
export function useDatos(visibleDesde: string, visibleHasta: string, cargaDesde: string, cargaHasta: string) {
  const [datos, setDatos] = useState<DatosHorario | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setDatos(await api.get<DatosHorario>(`/api/horario/datos?desde=${cargaDesde}&hasta=${cargaHasta}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [cargaDesde, cargaHasta])

  useEffect(() => { cargar() }, [cargar])

  const derivados = useMemo(() => {
    if (!datos) return null
    const tm = turnosMap(datos.turnos)
    const idx = indexAsignaciones(datos.asignaciones)
    const festivos = new Map(datos.festivos.map(f => [f.fecha, f]))
    const dias = new Map(datos.dias.map(d => [d.fecha, d]))
    const fechas = rangoFechas(visibleDesde, visibleHasta)
    const cob = new Map<string, Cobertura>()
    for (const f of fechas) {
      cob.set(f, cobertura(f, datos.asignaciones, datos.extras, tm, datos.ocupacion[f]?.personas ?? null, festivos.has(f), datos.config))
    }
    // un día sin ninguna asignación está "sin planificar": no se marca como falta
    const planificados = new Set(datos.asignaciones.map(a => a.fecha))
    const visibles = datos.empleados.filter(e => e.activo || idx.get(e.id)?.size)
    const avisos: Aviso[] = []
    for (const e of visibles) {
      avisos.push(...avisosEmpleado(e, idx.get(e.id) ?? new Map(), visibleDesde, visibleHasta, tm, datos.config))
    }
    return { tm, idx, festivos, dias, fechas, cob, visibles, avisos, planificados }
  }, [datos, visibleDesde, visibleHasta])

  /** Guarda celdas y actualiza en local sin recargar todo */
  const guardarAsignaciones = useCallback(async (items: AsigInput[]) => {
    setGuardando(true)
    setError('')
    try {
      await api.post('/api/horario/asignaciones', { items })
      setDatos(prev => {
        if (!prev) return prev
        const key = (a: { empleado_id: string; fecha: string }) => `${a.empleado_id}|${a.fecha}`
        const cambios = new Map(items.map(i => [key(i), i]))
        const resto = prev.asignaciones.filter(a => !cambios.has(key(a)))
        const nuevas: Asignacion[] = []
        cambios.forEach(i => {
          if (!i.tipo) return
          nuevas.push({
            empleado_id: i.empleado_id, fecha: i.fecha, tipo: i.tipo,
            turno: i.turno ?? null, inicio: i.inicio ?? null, fin: i.fin ?? null,
            inicio2: i.inicio2 ?? null, fin2: i.fin2 ?? null, horas: i.horas ?? null, nota: i.nota ?? null,
          })
        })
        return { ...prev, asignaciones: [...resto, ...nuevas] }
      })
      // el historial de ajustes lo genera el servidor: refrescar en segundo plano
      if (datos?.meses_publicados.length) cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      throw e
    } finally {
      setGuardando(false)
    }
  }, [datos?.meses_publicados.length, cargar])

  /** Alta/edición/borrado de recursos simples, y recarga */
  const guardarRecurso = useCallback(async (recurso: string, body: unknown) => {
    setGuardando(true)
    setError('')
    try {
      await api.post(`/api/horario/${recurso}`, body)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      throw e
    } finally {
      setGuardando(false)
    }
  }, [cargar])

  const borrarRecurso = useCallback(async (recurso: string, clave: string, valor: string) => {
    setGuardando(true)
    setError('')
    try {
      await api.del(`/api/horario/${recurso}?${clave}=${encodeURIComponent(valor)}`)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al borrar')
      throw e
    } finally {
      setGuardando(false)
    }
  }, [cargar])

  return { datos, d: derivados, error, setError, cargando, guardando, cargar, guardarAsignaciones, guardarRecurso, borrarRecurso }
}
