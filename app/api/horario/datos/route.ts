import { NextRequest } from 'next/server'
import { db } from '@/lib/horario/db'
import { dbCheck, handler, ok } from '@/lib/horario/http'
import * as v from '@/lib/horario/validate'
import {
  addDays,
  CONFIG_DEFECTO,
  type ConfigCobertura,
  type DatosHorario,
  type Ocupacion,
} from '@/lib/horario/core'

export const dynamic = 'force-dynamic'

interface ForecastDay { iso: string; adults?: number; children?: number; bkf?: number }
interface ForecastRow {
  created_at: string
  novotel_data: { days?: ForecastDay[] } | null
  ibis_data: { days?: ForecastDay[] } | null
}

// Misma lógica que la app de forecast: personas = adultos + niños de los dos
// hoteles, desayunos = BKF + niños, y todas las filas desplazadas +1 día.
// Para cada fecha manda el forecast más reciente que la incluya.
function ocupacionDesdeForecasts(rows: ForecastRow[], desde: string, hasta: string) {
  const out: Record<string, Ocupacion> = {}
  for (const row of rows) {
    const porFecha = new Map<string, { p: number; b: number }>()
    for (const hotel of [row.novotel_data, row.ibis_data]) {
      for (const d of hotel?.days ?? []) {
        if (typeof d?.iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.iso)) continue
        const f = addDays(d.iso, 1)
        const acc = porFecha.get(f) ?? { p: 0, b: 0 }
        const ch = Number(d.children) || 0
        acc.p += (Number(d.adults) || 0) + ch
        acc.b += (Number(d.bkf) || 0) + ch
        porFecha.set(f, acc)
      }
    }
    porFecha.forEach((val, f) => {
      if (f < desde || f > hasta || out[f]) return
      out[f] = { personas: val.p, desayunos: val.b, fuente: 'forecast' }
    })
  }
  return out
}

export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const desde = v.fecha(sp.get('desde'), 'desde')
  const hasta = v.fecha(sp.get('hasta'), 'hasta')
  if (hasta < desde || addDays(desde, 75) < hasta) throw new v.ErrorValidacion('Rango de fechas no válido (máx. 75 días)')

  const s = db()
  const [emp, tur, asig, ext, eve, ciu, fes, dias, cfg, meses, aj, fc] = await Promise.all([
    s.from('hr_empleados').select('*').order('orden').order('nombre'),
    s.from('hr_turnos').select('*').order('orden'),
    s.from('hr_asignaciones').select('*').gte('fecha', desde).lte('fecha', hasta),
    s.from('hr_extras').select('*').gte('fecha', desde).lte('fecha', hasta).order('inicio'),
    s.from('hr_eventos').select('*').gte('fecha', desde).lte('fecha', hasta).order('hora'),
    s.from('hr_eventos_ciudad').select('*').gte('fecha', desde).lte('fecha', hasta).order('hora'),
    s.from('hr_festivos').select('*').gte('fecha', desde).lte('fecha', hasta),
    s.from('hr_dias').select('*').gte('fecha', desde).lte('fecha', hasta),
    s.from('hr_config').select('valor').eq('clave', 'cobertura').maybeSingle(),
    s.from('hr_meses').select('mes'),
    s.from('hr_ajustes').select('*').gte('fecha', desde).lte('fecha', hasta).order('created_at', { ascending: false }).limit(500),
    s.from('forecasts').select('created_at, novotel_data, ibis_data').order('created_at', { ascending: false }).limit(30),
  ])
  for (const r of [emp, tur, asig, ext, eve, ciu, fes, dias, cfg, meses, aj]) dbCheck(r.error)
  if (fc.error) console.error('[horario] forecasts', fc.error.message)

  const ocupacion = ocupacionDesdeForecasts((fc.data ?? []) as ForecastRow[], desde, hasta)
  for (const d of dias.data ?? []) {
    if (d.ocupacion_manual != null) {
      ocupacion[d.fecha] = { personas: d.ocupacion_manual, desayunos: ocupacion[d.fecha]?.desayunos ?? null, fuente: 'manual' }
    }
  }

  const config: ConfigCobertura = { ...CONFIG_DEFECTO, ...((cfg.data?.valor as Partial<ConfigCobertura>) ?? {}) }
  const t = (x: string | null) => (x ? x.slice(0, 5) : null)

  const out: DatosHorario = {
    desde,
    hasta,
    empleados: (emp.data ?? []).map(e => ({ ...e, horas_contrato: e.horas_contrato == null ? null : Number(e.horas_contrato), saldo_festivos_inicial: Number(e.saldo_festivos_inicial) })),
    turnos: (tur.data ?? []).map(x => ({ ...x, inicio: t(x.inicio)!, fin: t(x.fin)! })),
    asignaciones: (asig.data ?? []).map(a => ({
      ...a, inicio: t(a.inicio), fin: t(a.fin), inicio2: t(a.inicio2), fin2: t(a.fin2),
      horas: a.horas == null ? null : Number(a.horas),
    })),
    extras: (ext.data ?? []).map(x => ({ ...x, inicio: t(x.inicio)!, fin: t(x.fin)! })),
    eventos: (eve.data ?? []).map(x => ({ ...x, hora: t(x.hora) })),
    ciudad: (ciu.data ?? []).map(x => ({ ...x, hora: t(x.hora) })),
    festivos: fes.data ?? [],
    dias: dias.data ?? [],
    ocupacion,
    config,
    meses_publicados: (meses.data ?? []).map(m => m.mes),
    ajustes: aj.data ?? [],
  }
  return ok(out)
})
