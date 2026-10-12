// Sincronización de partidos relevantes (Champions y LaLiga) desde
// football-data.org. Solo servidor: usa FOOTBALL_DATA_TOKEN.
import { db } from './db'

const API = 'https://api.football-data.org/v4'

// Competiciones del plan gratuito que nos interesan
const COMPETICIONES: Record<string, string> = { CL: 'Champions', PD: 'LaLiga' }

// Equipos de Madrid (ids de football-data.org). El nombre sirve de red de
// seguridad por si algún id cambiara.
const EQUIPOS_MADRID = new Map<number, string>([
  [86, 'Real Madrid'],
  [78, 'Atlético'],
  [87, 'Rayo'],
])
const RE_MADRID = /real madrid|atl[eé]tico de madrid|atl[eé]tico madrid|rayo vallecano/i

const DIAS_ADELANTE = 120

interface Equipo { id: number; name?: string; shortName?: string }
interface Partido {
  id: number
  utcDate: string
  status: string
  homeTeam: Equipo
  awayTeam: Equipo
}

function esMadrid(t: Equipo): boolean {
  return EQUIPOS_MADRID.has(t.id) || RE_MADRID.test(`${t.name ?? ''} ${t.shortName ?? ''}`)
}
function nombre(t: Equipo): string {
  return EQUIPOS_MADRID.get(t.id) ?? t.shortName ?? t.name ?? '¿?'
}

// Fecha y hora en Madrid a partir de la hora UTC del partido
function enMadrid(utc: string): { fecha: string; hora: string } {
  const d = new Date(utc)
  const p = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => p.find(x => x.type === t)?.value ?? '00'
  return { fecha: `${g('year')}-${g('month')}-${g('day')}`, hora: `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}` }
}

function isoUTC(d: Date) { return d.toISOString().slice(0, 10) }

export interface ResultadoSync { ok: boolean; importados: number; borrados: number; mensaje: string }

export async function sincronizarPartidos(): Promise<ResultadoSync> {
  const token = process.env.FOOTBALL_DATA_TOKEN
  if (!token) {
    return { ok: false, importados: 0, borrados: 0, mensaje: 'Falta FOOTBALL_DATA_TOKEN en Vercel' }
  }
  const hoy = new Date()
  const desde = isoUTC(hoy)
  const hasta = isoUTC(new Date(hoy.getTime() + DIAS_ADELANTE * 86400 * 1000))

  const filas: Record<string, unknown>[] = []
  const vistos = new Set<string>()
  for (const [code, comp] of Object.entries(COMPETICIONES)) {
    const res = await fetch(`${API}/competitions/${code}/matches?dateFrom=${desde}&dateTo=${hasta}`, {
      headers: { 'X-Auth-Token': token },
      cache: 'no-store',
    })
    if (res.status === 403 || res.status === 401) {
      return { ok: false, importados: 0, borrados: 0, mensaje: 'El token de football-data.org no es válido o no tiene acceso' }
    }
    if (res.status === 429) {
      return { ok: false, importados: 0, borrados: 0, mensaje: 'football-data.org: demasiadas peticiones, prueba en un minuto' }
    }
    if (!res.ok) throw new Error(`football-data.org ${code}: HTTP ${res.status}`)
    const data = (await res.json()) as { matches?: Partido[] }
    for (const m of data.matches ?? []) {
      if (!m?.id || typeof m.utcDate !== 'string') continue
      const local = esMadrid(m.homeTeam)
      if (!local && !esMadrid(m.awayTeam)) continue
      if (['CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(m.status)) continue
      const { fecha, hora } = enMadrid(m.utcDate)
      const ext = `fd:${m.id}`
      vistos.add(ext)
      filas.push({
        external_id: ext,
        fecha,
        // SCHEDULED = horario aún sin confirmar por la liga
        hora: m.status === 'SCHEDULED' ? null : hora,
        categoria: 'futbol',
        competicion: comp,
        en_madrid: local,
        descripcion: `${nombre(m.homeTeam)} - ${nombre(m.awayTeam)}`.slice(0, 120),
      })
    }
  }

  const s = db()
  if (filas.length) {
    const { error } = await s.from('hr_eventos_ciudad').upsert(filas, { onConflict: 'external_id' })
    if (error) throw new Error(error.message)
  }
  // Partidos futuros importados antes que ya no aparecen (aplazados/cancelados)
  const { data: previos, error: e2 } = await s.from('hr_eventos_ciudad')
    .select('id, external_id').not('external_id', 'is', null).gte('fecha', desde).lte('fecha', hasta)
  if (e2) throw new Error(e2.message)
  const sobran = (previos ?? []).filter(p => !vistos.has(p.external_id as string)).map(p => p.id as string)
  if (sobran.length) {
    const { error } = await s.from('hr_eventos_ciudad').delete().in('id', sobran)
    if (error) throw new Error(error.message)
  }
  const mensaje = `${filas.length} partidos en los próximos ${DIAS_ADELANTE} días`
  await s.from('hr_config').upsert({ clave: 'partidos_sync', valor: { at: new Date().toISOString(), mensaje } })
  return { ok: true, importados: filas.length, borrados: sobran.length, mensaje }
}
