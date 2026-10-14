// Lecturas comunes del libro de cambios (solo servidor).
import type { SupabaseClient } from '@supabase/supabase-js'
import { dbCheck } from '@/lib/horario/http'
import type { EntradaLibro, HojaLibro } from '@/lib/horario/libro'

export const CAMPOS = 'id, numero, fecha_peticion, empleado_id, empleado_nombre, detalle, cambios, detalle_manual, hoja, impreso_at, created_at, updated_at'

export async function hojasConFilas(s: SupabaseClient, numeros?: number[], limite = 60): Promise<HojaLibro[]> {
  let q = s.from('hr_libro_hojas').select('numero, impreso_at, firmada, firmada_at').order('numero', { ascending: false })
  q = numeros ? q.in('numero', numeros) : q.limit(limite)
  const h = await q
  dbCheck(h.error)
  const nums = (h.data ?? []).map(x => x.numero as number)
  if (!nums.length) return []
  const e = await s.from('hr_libro').select('numero, hoja').in('hoja', nums)
  dbCheck(e.error)
  return (h.data ?? []).map(x => {
    const filas = (e.data ?? []).filter(r => r.hoja === x.numero).map(r => r.numero as number)
    return {
      numero: x.numero as number,
      impreso_at: x.impreso_at as string,
      firmada: !!x.firmada,
      firmada_at: (x.firmada_at as string | null) ?? null,
      filas: filas.length,
      desde: filas.length ? Math.min(...filas) : null,
      hasta: filas.length ? Math.max(...filas) : null,
    }
  })
}

export async function entradasDeHojas(s: SupabaseClient, numeros: number[]): Promise<EntradaLibro[]> {
  if (!numeros.length) return []
  const r = await s.from('hr_libro').select(CAMPOS).in('hoja', numeros).order('numero')
  dbCheck(r.error)
  return (r.data ?? []) as EntradaLibro[]
}
