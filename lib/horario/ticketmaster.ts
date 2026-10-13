// Grandes conciertos y espectáculos en Madrid desde Ticketmaster (Discovery API).
// Solo servidor: usa TICKETMASTER_KEY. Criterio "impacto en ocupación":
//  - Estadios y grandes recintos (Metropolitano, Bernabéu, Iberdrola Music…): siempre, impacto ALTO.
//  - Arenas al lado del hotel (Movistar Arena, Las Ventas): solo si el artista
//    repite 2 o más noches (señal de mucha demanda), impacto medio.
//  - Deporte fuera (el fútbol ya viene por football-data; el baloncesto no mueve hotel).
import { db } from './db'

const API = 'https://app.ticketmaster.com/discovery/v2/events.json'
const MESES_ADELANTE = 9

interface Recinto { re: RegExp; nombre: string; tipo: 'estadio' | 'arena'; cerca: boolean }
const RECINTOS: Recinto[] = [
  { re: /metropolitano/i, nombre: 'Metropolitano', tipo: 'estadio', cerca: false },
  { re: /bernab[eé]u/i, nombre: 'Bernabéu', tipo: 'estadio', cerca: false },
  { re: /iberdrola music|espacio mad ?cool|ciudad del rock/i, nombre: 'Iberdrola Music', tipo: 'estadio', cerca: false },
  { re: /movistar arena|wizink|palacio de (los )?deportes/i, nombre: 'Movistar Arena', tipo: 'arena', cerca: true },
  { re: /las ventas|plaza de toros/i, nombre: 'Las Ventas', tipo: 'arena', cerca: true },
]
// Entradas "accesorias" que no son un evento en sí
const RE_ACCESORIO = /parking|aparcamiento|\bvip\b|paquete|package|upgrade|hospitality|merch|experiencia|meet ?& ?greet|early entry|acceso anticipado|palco/i

interface TmEvento {
  id: string
  name?: string
  dates?: { start?: { localDate?: string; localTime?: string }; status?: { code?: string } }
  classifications?: { segment?: { name?: string } }[]
  _embedded?: { venues?: { name?: string }[]; attractions?: { name?: string }[] }
}

function normaliza(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export interface ResultadoTm { ok: boolean; importados: number; borrados: number; mensaje: string }

export async function sincronizarTicketmaster(): Promise<ResultadoTm> {
  const key = process.env.TICKETMASTER_KEY
  if (!key) return { ok: false, importados: 0, borrados: 0, mensaje: 'Falta TICKETMASTER_KEY en Vercel' }

  const hoy = new Date()
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + MESES_ADELANTE, hoy.getDate())
  const iso = (d: Date) => d.toISOString().slice(0, 19) + 'Z'
  const desdeF = hoy.toISOString().slice(0, 10)
  const hastaF = hasta.toISOString().slice(0, 10)

  const brutos: TmEvento[] = []
  for (let page = 0; page < 5; page++) {
    const url = `${API}?apikey=${encodeURIComponent(key)}&city=Madrid&countryCode=ES&locale=*&size=200&page=${page}`
      + `&startDateTime=${iso(hoy)}&endDateTime=${iso(hasta)}&sort=date,asc`
    const res = await fetch(url, { cache: 'no-store' })
    if (res.status === 401 || res.status === 403) return { ok: false, importados: 0, borrados: 0, mensaje: 'La clave de Ticketmaster no es válida' }
    if (res.status === 429) return { ok: false, importados: 0, borrados: 0, mensaje: 'Ticketmaster: demasiadas peticiones, prueba en un minuto' }
    if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`)
    const j = (await res.json()) as { _embedded?: { events?: TmEvento[] }; page?: { totalPages?: number } }
    brutos.push(...(j._embedded?.events ?? []))
    if (page + 1 >= (j.page?.totalPages ?? 0)) break
    await new Promise(r => setTimeout(r, 250)) // límite de 5 peticiones/segundo
  }

  // Filtrar y agrupar por (artista, recinto, día)
  type Fila = { fecha: string; hora: string | null; artista: string; recinto: Recinto; segmento: string }
  const filas = new Map<string, Fila>()
  for (const e of brutos) {
    const fecha = e.dates?.start?.localDate
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue
    if (['cancelled', 'postponed'].includes(e.dates?.status?.code ?? '')) continue
    const segmento = e.classifications?.[0]?.segment?.name ?? ''
    if (/sport/i.test(segmento)) continue
    const venue = e._embedded?.venues?.[0]?.name ?? ''
    const recinto = RECINTOS.find(r => r.re.test(venue))
    if (!recinto) continue
    const nombre = (e.name ?? '').trim()
    if (!nombre || RE_ACCESORIO.test(nombre)) continue
    const artista = (e._embedded?.attractions?.[0]?.name ?? nombre).trim()
    const k = `${normaliza(artista)}|${recinto.nombre}|${fecha}`
    if (!filas.has(k)) {
      const h = e.dates?.start?.localTime
      filas.set(k, { fecha, hora: h && /^\d{2}:\d{2}/.test(h) ? h.slice(0, 5) : null, artista, recinto, segmento })
    }
  }
  // Noches por artista y recinto (para las arenas)
  const noches = new Map<string, number>()
  filas.forEach(f => {
    const k = `${normaliza(f.artista)}|${f.recinto.nombre}`
    noches.set(k, (noches.get(k) ?? 0) + 1)
  })

  const salida: Record<string, unknown>[] = []
  filas.forEach(f => {
    const n = noches.get(`${normaliza(f.artista)}|${f.recinto.nombre}`) ?? 1
    if (f.recinto.tipo === 'arena' && n < 2) return
    const impacto = f.recinto.tipo === 'estadio' ? 'impacto ALTO' : 'impacto medio'
    const extra = [n > 1 ? `${n} noches` : '', f.recinto.cerca ? 'al lado del hotel' : ''].filter(Boolean).join(', ')
    salida.push({
      external_id: `tm:${normaliza(f.artista).slice(0, 60).replace(/ /g, '-')}:${f.recinto.nombre}:${f.fecha}`,
      fecha: f.fecha,
      hora: f.hora,
      categoria: /music|m[uú]sica/i.test(f.segmento) || !f.segmento ? 'concierto' : 'otro',
      descripcion: `${f.artista}${extra ? ` (${extra})` : ''} · ${f.recinto.nombre} · ${impacto}`.slice(0, 120),
      en_madrid: true,
    })
  })

  const s = db()
  if (salida.length) {
    const { error } = await s.from('hr_eventos_ciudad').upsert(salida, { onConflict: 'external_id' })
    if (error) throw new Error(error.message)
  }
  // Quitar los que ya no aparecen (cancelados o retirados), solo los de Ticketmaster
  const vistos = new Set(salida.map(x => x.external_id as string))
  const { data: previos, error: e2 } = await s.from('hr_eventos_ciudad')
    .select('id, external_id').like('external_id', 'tm:%').gte('fecha', desdeF).lte('fecha', hastaF)
  if (e2) throw new Error(e2.message)
  const sobran = (previos ?? []).filter(p => !vistos.has(p.external_id as string)).map(p => p.id as string)
  if (sobran.length) {
    const { error } = await s.from('hr_eventos_ciudad').delete().in('id', sobran)
    if (error) throw new Error(error.message)
  }
  // Si un concierto cargado a mano (manual:…) ya viene de Ticketmaster el mismo día, quitar el manual
  const { data: manuales } = await s.from('hr_eventos_ciudad')
    .select('id, fecha, descripcion').like('external_id', 'manual:%').eq('categoria', 'concierto').gte('fecha', desdeF).lte('fecha', hastaF)
  const duplicados = (manuales ?? []).filter(m => Array.from(filas.values()).some(f =>
    f.fecha === m.fecha && normaliza(m.descripcion as string).startsWith(normaliza(f.artista)))).map(m => m.id as string)
  if (duplicados.length) await s.from('hr_eventos_ciudad').delete().in('id', duplicados)

  return { ok: true, importados: salida.length, borrados: sobran.length, mensaje: `${salida.length} días de grandes conciertos en los próximos ${MESES_ADELANTE} meses` }
}
