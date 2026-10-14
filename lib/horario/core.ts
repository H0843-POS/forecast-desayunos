// Lógica pura del módulo Horario (sin secretos ni acceso a BD).
// Se usa tanto en el servidor como en el navegador.

export type Franja = 'manana' | 'mediodia' | 'tarde'
export const FRANJAS: Franja[] = ['manana', 'mediodia', 'tarde']
export const FRANJA_LABEL: Record<Franja, string> = {
  manana: 'Mañana',
  mediodia: 'Mediodía',
  tarde: 'Tarde',
}

export type TipoAsig = 'T' | 'L' | 'V' | 'BJ' | 'FO' | 'B'
export const AUSENCIAS: { tipo: Exclude<TipoAsig, 'T'>; label: string }[] = [
  { tipo: 'L', label: 'Libre' },
  { tipo: 'V', label: 'Vacaciones' },
  { tipo: 'BJ', label: 'Baja' },
  { tipo: 'FO', label: 'Formación' },
  { tipo: 'B', label: 'Festivo devuelto' },
]

export interface Empleado {
  id: string
  nombre: string
  tipo: 'plantilla' | 'extra'
  horas_contrato: number | null
  saldo_festivos_inicial: number
  orden: number
  activo: boolean
  notas?: string | null
}
export interface Turno {
  codigo: string
  inicio: string
  fin: string
  orden: number
  activo: boolean
}
export interface Asignacion {
  id?: string
  empleado_id: string
  fecha: string
  tipo: TipoAsig
  turno: string | null
  inicio: string | null
  fin: string | null
  inicio2: string | null
  fin2: string | null
  horas: number | null
  nota: string | null
  /** solo L: lunes de la semana a la que corresponde el libre (null = la suya) */
  libre_de?: string | null
}
export type Motivo = 'evento' | 'ocupacion' | 'refuerzo' | 'otro'
export const MOTIVOS: Motivo[] = ['evento', 'ocupacion', 'refuerzo', 'otro']
export const MOTIVO_LABEL: Record<Motivo, string> = { evento: 'Evento', ocupacion: 'Ocupación', refuerzo: 'Refuerzo', otro: 'Otro' }
export interface Extra {
  id: string
  fecha: string
  cantidad: number
  inicio: string
  fin: string
  motivo: Motivo
  origen: string
  nota: string | null
}
export interface Evento {
  id: string
  fecha: string
  hora: string | null
  franja: Franja | null
  pax: number | null
  tipo: string | null
  nombre: string | null
  nota: string | null
}
export interface EventoCiudad {
  id: string
  fecha: string
  hora: string | null
  categoria: 'futbol' | 'concierto' | 'feria' | 'otro'
  descripcion: string
  competicion?: string | null
  en_madrid?: boolean
  external_id?: string | null
}
export interface Festivo {
  fecha: string
  nombre: string
  ambito: 'nacional' | 'autonomico' | 'local'
}
export interface Dia {
  fecha: string
  ocupacion_manual: number | null
  nota_manana: string | null
  nota_mediodia: string | null
  nota_tarde: string | null
}
export interface Ajuste {
  id: string
  fecha: string
  empleado_id: string | null
  empleado_nombre: string
  antes: string
  despues: string
  created_at: string
}
export interface ConfigCobertura {
  laborable: Record<Franja, number>
  finde: Record<Franja, number>
  finde_por_centena: boolean
  festivo_como_finde: boolean
  codigos_obligatorios: string[]
  min_libres_semana: number
}
export const CONFIG_DEFECTO: ConfigCobertura = {
  laborable: { manana: 4, mediodia: 4, tarde: 4 },
  finde: { manana: 4, mediodia: 2, tarde: 4 },
  finde_por_centena: true,
  festivo_como_finde: true,
  codigos_obligatorios: ['AP', 'M7', 'M8', 'M9'],
  min_libres_semana: 2,
}
export interface Ocupacion {
  personas: number
  desayunos: number | null
  fuente: 'forecast' | 'manual'
  /** cuándo se subió el forecast del que sale el dato */
  cargado?: string
}

export interface DatosHorario {
  desde: string
  hasta: string
  empleados: Empleado[]
  turnos: Turno[]
  asignaciones: Asignacion[]
  extras: Extra[]
  eventos: Evento[]
  ciudad: EventoCiudad[]
  festivos: Festivo[]
  dias: Dia[]
  ocupacion: Record<string, Ocupacion>
  config: ConfigCobertura
  meses_publicados: string[]
  ajustes: Ajuste[]
  /** filas del libro de cambios sin imprimir (null = libro sin instalar) */
  libro_pendientes?: number | null
}

// ---------------------------------------------------------------- fechas

export function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s: string, n: number): string {
  const d = parseIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
export function rangoFechas(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let f = desde; f <= hasta; f = addDays(f, 1)) out.push(f)
  return out
}
/** Lunes de la semana de la fecha */
export function lunes(s: string): string {
  const d = parseIso(s)
  const dow = (d.getDay() + 6) % 7
  return addDays(s, -dow)
}
export function diaSemana(s: string): number {
  return parseIso(s).getDay() // 0 = domingo
}
export const DIAS_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export function finDeMes(mes: string): string {
  const d = parseIso(mes)
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

// ---------------------------------------------------------------- horas

export function hm(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}
export function fmtHm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export function corto(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

/** El turno de comidas empieza a las 11:00 */
export const INICIO_COMIDAS = 11 * 60

/** Franja "de origen" de un turno según su hora de entrada (para color y agrupar) */
export function franjaDeMinuto(min: number): Franja {
  if (min < INICIO_COMIDAS) return 'manana'
  if (min < 15 * 60) return 'mediodia'
  return 'tarde'
}

// Cobertura por PRESENCIA, como en la hoja en papel:
//  - desayunos: entra antes de las 11:00 (AP, M7, M8, M9)
//  - comidas:   está presente de 14:00 a 16:00 (M8, M9, P13, P14…)
//  - cenas:     está presente de 21:00 a 23:00 (T16, T17, T18…)
// Así un M9 cuenta en desayunos y en comidas, igual que lo apuntáis a mano.
export const VENTANA_COMIDAS: [number, number] = [14 * 60, 16 * 60]
export const VENTANA_CENAS: [number, number] = [21 * 60, 23 * 60]

function cubre(s: Segmento, [a, b]: [number, number]): boolean {
  return (s.ini <= a && s.fin >= b) || (s.ini <= a + 1440 && s.fin >= b + 1440)
}

export function franjasCubiertas(s: Segmento): Set<Franja> {
  const out = new Set<Franja>()
  if (s.ini % 1440 < INICIO_COMIDAS) out.add('manana')
  if (cubre(s, VENTANA_COMIDAS)) out.add('mediodia')
  if (cubre(s, VENTANA_CENAS)) out.add('tarde')
  return out
}

export interface Segmento {
  ini: number
  fin: number // > ini (puede pasar de 1440 si cruza medianoche)
}

function seg(ini: number | null, fin: number | null): Segmento | null {
  if (ini == null || fin == null) return null
  let f = fin
  if (f <= ini) f += 1440
  return { ini, fin: f }
}

export function segmentos(a: Asignacion, turnos: Map<string, Turno>): Segmento[] {
  if (a.tipo !== 'T') return []
  const t = a.turno ? turnos.get(a.turno) : undefined
  const ini = hm(a.inicio) ?? hm(t?.inicio)
  const fin = hm(a.fin) ?? hm(t?.fin)
  const out: Segmento[] = []
  const s1 = seg(ini, fin)
  if (s1) out.push(s1)
  const s2 = seg(hm(a.inicio2), hm(a.fin2))
  if (s2) {
    // el segundo tramo del partido empieza después del primero
    if (s1 && s2.ini < s1.ini) { s2.ini += 1440; s2.fin += 1440 }
    out.push(s2)
  }
  return out
}

export function horasAsignacion(a: Asignacion, turnos: Map<string, Turno>, emp?: Empleado): number {
  if (a.tipo === 'T') {
    return segmentos(a, turnos).reduce((s, x) => s + (x.fin - x.ini), 0) / 60
  }
  if (a.tipo === 'FO') {
    if (a.horas != null) return Number(a.horas)
    if (emp?.horas_contrato) return Number(emp.horas_contrato) / 5
    return 8
  }
  return 0
}

/** Horas entre 22:00 y 06:00 */
export function horasNocturnas(a: Asignacion, turnos: Map<string, Turno>): number {
  const ventanas: Segmento[] = [
    { ini: -120, fin: 360 },
    { ini: 1320, fin: 1800 },
    { ini: 2760, fin: 3240 },
  ]
  let total = 0
  for (const s of segmentos(a, turnos)) {
    for (const v of ventanas) total += Math.max(0, Math.min(s.fin, v.fin) - Math.max(s.ini, v.ini))
  }
  return total / 60
}

export type ColorTurno = 'rosa' | 'blanco' | 'verde' | 'ausencia' | 'libre'
/** En la hoja semanal las comidas van en azul claro (en el mensual siguen en blanco) */
export const AZUL_COMIDAS = { bg: '#dbeafe', fg: '#1e3a8a', rgb: [219, 234, 254] as [number, number, number] }
export function colorAsignacion(a: Asignacion | undefined, turnos: Map<string, Turno>): ColorTurno | null {
  if (!a) return null
  if (a.tipo === 'L') return 'libre'
  if (a.tipo !== 'T') return 'ausencia'
  const s = segmentos(a, turnos)[0]
  if (!s) return 'blanco'
  const f = franjaDeMinuto(s.ini)
  return f === 'manana' ? 'rosa' : f === 'mediodia' ? 'blanco' : 'verde'
}

export const COLORES: Record<ColorTurno, { bg: string; fg: string; rgb: [number, number, number] }> = {
  rosa: { bg: '#f8d7e3', fg: '#6d1b3b', rgb: [248, 215, 227] },
  blanco: { bg: '#ffffff', fg: '#1a1916', rgb: [255, 255, 255] },
  verde: { bg: '#d6f0d2', fg: '#1d5a1f', rgb: [214, 240, 210] },
  ausencia: { bg: '#ecebe6', fg: '#4a4842', rgb: [236, 235, 230] },
  libre: { bg: '#ffffff', fg: '#a8a59e', rgb: [255, 255, 255] },
}

/** Texto corto que se muestra en la celda */
export function etiqueta(a: Asignacion | undefined, turnos: Map<string, Turno>): string {
  if (!a) return ''
  if (a.tipo === 'L') return `L${semanaISO(a.libre_de ?? a.fecha).semana}`
  if (a.tipo !== 'T') return a.tipo
  const t = a.turno ? turnos.get(a.turno) : undefined
  const custom = (a.inicio && a.fin) || a.inicio2
  if (t && !custom) return t.codigo
  const s = segmentos(a, turnos)
  const h = (m: number) => { const x = m % 1440; return x % 60 ? `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}` : String(Math.floor(x / 60)) }
  const txt = s.map(x => `${h(x.ini)}-${h(x.fin)}`).join('/')
  return a.turno ? `${a.turno}*` : txt
}

/** Descripción completa (para historial de ajustes y tooltips) */
export function describir(a: Asignacion | undefined | null, turnos: Map<string, Turno>): string {
  if (!a) return '—'
  if (a.tipo === 'L') return `Libre L${semanaISO(a.libre_de ?? a.fecha).semana}`
  if (a.tipo !== 'T') {
    const lab = AUSENCIAS.find(x => x.tipo === a.tipo)?.label ?? a.tipo
    return a.tipo === 'FO' && a.horas != null ? `${lab} (${a.horas}h)` : lab
  }
  const s = segmentos(a, turnos)
  const horas = s.map(x => `${fmtHm(x.ini)}-${fmtHm(x.fin)}`).join(' + ')
  return a.turno ? `${a.turno} ${horas}` : horas
}

// ---------------------------------------------------------------- cobertura

export function esFinde(fecha: string): boolean {
  const d = diaSemana(fecha)
  return d === 0 || d === 6
}

export interface Requisito {
  manana: number
  mediodia: number
  tarde: number
  regla: 'laborable' | 'finde' | 'festivo'
}

export function requisitos(
  fecha: string,
  ocupacion: number | null,
  festivo: boolean,
  cfg: ConfigCobertura,
): Requisito {
  const finde = esFinde(fecha)
  const comoFinde = finde || (festivo && cfg.festivo_como_finde)
  if (!comoFinde) return { ...cfg.laborable, regla: 'laborable' }
  const porOcupacion = cfg.finde_por_centena && ocupacion ? Math.floor(ocupacion / 100) : 0
  return {
    manana: Math.max(cfg.finde.manana, porOcupacion),
    mediodia: cfg.finde.mediodia,
    tarde: cfg.finde.tarde,
    regla: finde ? 'finde' : 'festivo',
  }
}

export interface Cobertura {
  tiene: Record<Franja, number>
  necesita: Record<Franja, number>
  faltanCodigos: string[]
  regla: Requisito['regla']
}

export function cobertura(
  fecha: string,
  asignaciones: Asignacion[],
  extras: Extra[],
  turnos: Map<string, Turno>,
  ocupacion: number | null,
  festivo: boolean,
  cfg: ConfigCobertura,
): Cobertura {
  const tiene: Record<Franja, number> = { manana: 0, mediodia: 0, tarde: 0 }
  const iniciosCubiertos = new Set<number>()
  for (const a of asignaciones) {
    if (a.fecha !== fecha || a.tipo !== 'T') continue
    const franjas = new Set<Franja>()
    for (const s of segmentos(a, turnos)) {
      franjasCubiertas(s).forEach(f => franjas.add(f))
      iniciosCubiertos.add(s.ini % 1440)
    }
    franjas.forEach(f => (tiene[f] += 1))
  }
  for (const e of extras) {
    if (e.fecha !== fecha) continue
    const s = seg(hm(e.inicio), hm(e.fin))
    if (!s) continue
    franjasCubiertas(s).forEach(f => (tiene[f] += e.cantidad))
    iniciosCubiertos.add(s.ini)
  }
  const req = requisitos(fecha, ocupacion, festivo, cfg)
  const faltanCodigos = cfg.codigos_obligatorios.filter(c => {
    const t = turnos.get(c)
    const ini = hm(t?.inicio)
    return ini != null && !iniciosCubiertos.has(ini)
  })
  return {
    tiene,
    necesita: { manana: req.manana, mediodia: req.mediodia, tarde: req.tarde },
    faltanCodigos,
    regla: req.regla,
  }
}

export function franjaEvento(e: Evento): Franja {
  const h = hm(e.hora)
  if (h != null) return h < INICIO_COMIDAS ? 'manana' : h < 16 * 60 ? 'mediodia' : 'tarde'
  return e.franja ?? 'mediodia'
}

// ---------------------------------------------------------------- avisos legales

export interface Aviso {
  empleado_id: string
  fecha: string
  nivel: 'error' | 'aviso'
  texto: string
}

const TRABAJA = (a?: Asignacion) => !!a && (a.tipo === 'T' || a.tipo === 'FO')

export function avisosEmpleado(
  emp: Empleado,
  porFecha: Map<string, Asignacion>,
  desde: string,
  hasta: string,
  turnos: Map<string, Turno>,
  cfg: ConfigCobertura,
): Aviso[] {
  const out: Aviso[] = []
  // 1) Descanso mínimo de 12 h entre jornadas
  for (let f = addDays(desde, -1); f < hasta; f = addDays(f, 1)) {
    const a = porFecha.get(f)
    const b = porFecha.get(addDays(f, 1))
    if (!a || !b || a.tipo !== 'T' || b.tipo !== 'T') continue
    const sa = segmentos(a, turnos)
    const sb = segmentos(b, turnos)
    if (!sa.length || !sb.length) continue
    const finA = Math.max(...sa.map(s => s.fin))
    const iniB = 1440 + Math.min(...sb.map(s => s.ini))
    const gap = (iniB - finA) / 60
    if (gap < 12) {
      out.push({
        empleado_id: emp.id,
        fecha: addDays(f, 1),
        nivel: 'error',
        texto: `${emp.nombre}: solo ${gap.toFixed(1).replace('.0', '')} h de descanso entre el ${f.slice(8)} y el ${addDays(f, 1).slice(8)} (mínimo 12 h)`,
      })
    }
  }
  if (emp.tipo !== 'plantilla') return out

  // 2) Semanas (lunes-domingo): horas vs contrato y días libres
  for (let w = lunes(desde); w <= hasta; w = addDays(w, 7)) {
    const dias = rangoFechas(w, addDays(w, 6))
    const asig = dias.map(d => porFecha.get(d))
    const completa = asig.every(Boolean)
    const horas = asig.reduce((s, a) => s + (a ? horasAsignacion(a, turnos, emp) : 0), 0)
    const ausencias = asig.filter(a => a && (a.tipo === 'V' || a.tipo === 'BJ' || a.tipo === 'B')).length
    if (emp.horas_contrato != null) {
      const contrato = Number(emp.horas_contrato)
      const esperado = Math.max(0, contrato - (contrato / 5) * ausencias)
      const dif = horas - esperado
      if (dif > 0.5) {
        out.push({ empleado_id: emp.id, fecha: w, nivel: 'error',
          texto: `${emp.nombre}: ${fmtH(horas)} h la semana del ${w.slice(8)}/${w.slice(5, 7)} (contrato ${fmtH(esperado)} h, +${fmtH(dif)})` })
      } else if (completa && dif < -0.5) {
        out.push({ empleado_id: emp.id, fecha: w, nivel: 'aviso',
          texto: `${emp.nombre}: ${fmtH(horas)} h la semana del ${w.slice(8)}/${w.slice(5, 7)} (contrato ${fmtH(esperado)} h, faltan ${fmtH(-dif)})` })
      }
    }
    if (completa && ausencias < 7) {
      const libres = asig.filter(a => !TRABAJA(a)).length
      if (libres < cfg.min_libres_semana) {
        out.push({ empleado_id: emp.id, fecha: w, nivel: 'error',
          texto: `${emp.nombre}: ${libres} día(s) libre(s) la semana del ${w.slice(8)}/${w.slice(5, 7)} (mínimo ${cfg.min_libres_semana})` })
      }
    }
  }

  // 3) Más de 6 días seguidos trabajando
  let racha = 0
  for (let f = addDays(desde, -6); f <= hasta; f = addDays(f, 1)) {
    racha = TRABAJA(porFecha.get(f)) ? racha + 1 : 0
    if (racha === 7 && f >= desde) {
      out.push({ empleado_id: emp.id, fecha: f, nivel: 'error',
        texto: `${emp.nombre}: 7 días seguidos trabajando hasta el ${f.slice(8)}/${f.slice(5, 7)}` })
    }
  }
  return out
}

export function fmtH(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',')
}

export function turnosMap(turnos: Turno[]): Map<string, Turno> {
  return new Map(turnos.map(t => [t.codigo, t]))
}

export function indexAsignaciones(asig: Asignacion[]): Map<string, Map<string, Asignacion>> {
  const m = new Map<string, Map<string, Asignacion>>()
  for (const a of asig) {
    if (!m.has(a.empleado_id)) m.set(a.empleado_id, new Map())
    m.get(a.empleado_id)!.set(a.fecha, a)
  }
  return m
}

// ---------------------------------------------------------------- semanas ISO (L1, L2…)

/** Semana ISO (lunes a domingo; la semana 1 es la que contiene el primer jueves del año) */
export function semanaISO(fecha: string): { anio: number; semana: number } {
  const d = parseIso(fecha)
  const jueves = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const anio = jueves.getFullYear()
  const ene4 = new Date(anio, 0, 4)
  const semana = 1 + Math.round(((jueves.getTime() - ene4.getTime()) / 86400000 - 3 + ((ene4.getDay() + 6) % 7)) / 7)
  return { anio, semana }
}

/** Lunes de la semana ISO n del año */
export function lunesSemanaISO(anio: number, semana: number): string {
  const ene4 = new Date(anio, 0, 4)
  const lunes1 = new Date(anio, 0, 4 - ((ene4.getDay() + 6) % 7))
  return iso(new Date(lunes1.getFullYear(), lunes1.getMonth(), lunes1.getDate() + (semana - 1) * 7))
}

/** "L40" escrito el día `fecha`: la última semana 40 que no sea posterior a la semana siguiente */
export function lunesDeLibre(semana: number, fecha: string): string {
  const { anio } = semanaISO(fecha)
  const tope = addDays(lunes(fecha), 7)
  const cands = [anio - 1, anio, anio + 1]
    .map(a => lunesSemanaISO(a, semana))
    .filter(l => semanaISO(l).semana === semana && l <= tope)
    .sort()
  if (!cands.length) throw new Error('Semana no válida')
  return cands[cands.length - 1]
}

// ---------------------------------------------------------------- escribir un turno a mano

export type Entrada = Omit<Partial<Asignacion>, 'tipo'> & { tipo: TipoAsig | null }

/**
 * Interpreta lo que se escribe en una celda:
 *   "M9", "t17"            → turno predefinido
 *   "9-17", "9:30-17:30"   → si coincide con un turno predefinido lo usa; si no, horario libre
 *   "10-14/20-24"          → turno partido
 *   "L", "L40"             → libre (de la semana 40), "V", "BJ", "FO", "FO4" (4 h), "B"
 *   "" o "-"               → vaciar
 */
export function parseEntrada(texto: string, fecha: string, turnos: Map<string, Turno>): Entrada {
  const t = texto.trim().toUpperCase().replace(/\s+/g, '')
  if (t === '' || t === '-') return { tipo: null }
  if (turnos.has(t)) return { tipo: 'T', turno: t }
  const mL = /^L(\d{1,2})?$/.exec(t)
  if (mL) {
    if (!mL[1]) return { tipo: 'L', libre_de: null }
    const n = Number(mL[1])
    if (n < 1 || n > 53) throw new Error('Semana no válida (1-53)')
    const l = lunesDeLibre(n, fecha)
    return { tipo: 'L', libre_de: l === lunes(fecha) ? null : l }
  }
  const mFO = /^FO(\d{1,2}(?:[.,]\d{1,2})?)?$/.exec(t)
  if (mFO) return { tipo: 'FO', horas: mFO[1] ? Number(mFO[1].replace(',', '.')) : null }
  if (t === 'V' || t === 'BJ' || t === 'B') return { tipo: t }

  const hora = (x: string): string => {
    const m = /^(\d{1,2})(?:[:.H]?(\d{2}))?$/.exec(x)
    if (!m) throw new Error(`No entiendo "${texto}"`)
    let h = Number(m[1]); const mi = Number(m[2] ?? 0)
    if (h === 24) h = 0
    if (h > 23 || mi > 59) throw new Error(`Hora no válida en "${texto}"`)
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
  }
  const tramos = t.split('/').map(p => {
    const m = /^([\d:.H]+)-([\d:.H]+)$/.exec(p)
    if (!m) throw new Error(`No entiendo "${texto}". Ejemplos: M9, 9-17, 10-14/20-24, L, L40, V, BJ, FO, B`)
    return [hora(m[1]), hora(m[2])] as const
  })
  if (tramos.length > 2) throw new Error('Máximo dos tramos (turno partido)')
  const [ini, fin] = tramos[0]
  if (tramos.length === 1) {
    for (const tu of Array.from(turnos.values())) {
      if (tu.activo && tu.inicio === ini && tu.fin === fin) return { tipo: 'T', turno: tu.codigo }
    }
    return { tipo: 'T', turno: null, inicio: ini, fin }
  }
  return { tipo: 'T', turno: null, inicio: ini, fin, inicio2: tramos[1][0], fin2: tramos[1][1] }
}

/** Texto para mostrar en el campo al editar una celda (lo inverso de parseEntrada) */
export function textoEntrada(a: Asignacion | undefined, turnos: Map<string, Turno>): string {
  if (!a) return ''
  if (a.tipo === 'L') return a.libre_de ? `L${semanaISO(a.libre_de).semana}` : 'L'
  if (a.tipo === 'FO') return a.horas != null ? `FO${a.horas}` : 'FO'
  if (a.tipo !== 'T') return a.tipo
  if (a.turno && !a.inicio && !a.inicio2) return a.turno
  return segmentos(a, turnos).map(x => `${fmtHm(x.ini)}-${fmtHm(x.fin)}`).join('/')
}

export const ICONO_CIUDAD: Record<EventoCiudad['categoria'], string> = { futbol: '⚽', concierto: '🎤', feria: '🏛', otro: '📍' }
