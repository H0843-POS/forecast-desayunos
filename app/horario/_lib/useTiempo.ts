'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/horario/client'
import type { TiempoDia } from '@/lib/horario/tiempo'

export function useTiempo() {
  const [tiempo, setTiempo] = useState<Map<string, TiempoDia>>(new Map())
  const [actualizado, setActualizado] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async (fresco = false) => {
    setCargando(true); setError('')
    try {
      const r = await api.get<{ dias: TiempoDia[]; actualizado?: string; error?: string }>(`/api/horario/tiempo${fresco ? '?fresco=1' : ''}`)
      setTiempo(new Map(r.dias.map(d => [d.fecha, d])))
      setActualizado(r.actualizado ?? null)
      if (r.error) setError(r.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el tiempo')
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { tiempo, actualizado, cargando, error, actualizar: () => cargar(true) }
}
