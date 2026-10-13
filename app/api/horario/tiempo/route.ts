import { NextRequest } from 'next/server'
import { handler, ok } from '@/lib/horario/http'
import { LAS_VENTAS, type TiempoDia } from '@/lib/horario/tiempo'

export const dynamic = 'force-dynamic'

// Previsión de 16 días para Las Ventas. Se guarda en caché 1 h; con ?fresco=1
// (botón "Actualizar tiempo") se pide de nuevo a Open-Meteo.
export const GET = handler(async (req: NextRequest) => {
  const fresco = req.nextUrl.searchParams.get('fresco') === '1'
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${LAS_VENTAS.lat}&longitude=${LAS_VENTAS.lon}`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum'
    + '&timezone=Europe%2FMadrid&forecast_days=16'
  let res: Response
  try {
    res = await fetch(url, fresco ? { cache: 'no-store' } : { next: { revalidate: 3600 } })
  } catch {
    return ok({ dias: [], error: 'No se puede conectar con Open-Meteo' })
  }
  if (!res.ok) return ok({ dias: [], error: `Open-Meteo no responde (${res.status})` })
  const j = await res.json() as {
    daily?: {
      time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]
      precipitation_probability_max?: (number | null)[]; precipitation_sum?: (number | null)[]
    }
  }
  const d = j.daily
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  const dias: TiempoDia[] = (d?.time ?? [])
    .map((fecha, i) => ({
      fecha,
      codigo: num(d?.weather_code?.[i]) ?? -1,
      max: num(d?.temperature_2m_max?.[i]),
      min: num(d?.temperature_2m_min?.[i]),
      lluvia: num(d?.precipitation_probability_max?.[i]),
      mm: num(d?.precipitation_sum?.[i]),
    }))
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.fecha))
  return ok({ dias, actualizado: new Date().toISOString() })
})
