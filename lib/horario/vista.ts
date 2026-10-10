// Agrupa los datos de un día por franjas, como en la hoja semanal en papel.
import {
  FRANJAS,
  fmtHm,
  franjaDeMinuto,
  franjasCubiertas,
  franjaEvento,
  hm,
  horasAsignacion,
  segmentos,
  type Asignacion,
  type Cobertura,
  type DatosHorario,
  type Empleado,
  type Evento,
  type Extra,
  type Franja,
  type Turno,
} from './core'

export interface GrupoTurno {
  label: string
  ini: number
  personas: { emp: Empleado; asig: Asignacion; horario: string }[]
}
export interface VistaFranja {
  franja: Franja
  grupos: GrupoTurno[]
  /** personas que también cuentan en esta franja aunque su turno empiece en otra (p. ej. M9 en comidas) */
  apoyo: { emp: Empleado; label: string }[]
  eventos: Evento[]
  extras: Extra[]
  nota: string | null
  tiene: number
  necesita: number
}
export interface VistaDia {
  fecha: string
  franjas: Record<Franja, VistaFranja>
  ausentes: { emp: Empleado; asig: Asignacion }[]
  faltanCodigos: string[]
}

export function vistaDia(
  fecha: string,
  datos: DatosHorario,
  tm: Map<string, Turno>,
  cob: Cobertura | undefined,
): VistaDia {
  const emp = new Map(datos.empleados.map(e => [e.id, e]))
  const dia = datos.dias.find(d => d.fecha === fecha)
  const franjas = {} as Record<Franja, VistaFranja>
  for (const f of FRANJAS) {
    franjas[f] = {
      franja: f,
      grupos: [],
      apoyo: [],
      eventos: [],
      extras: [],
      nota: (f === 'manana' ? dia?.nota_manana : f === 'mediodia' ? dia?.nota_mediodia : dia?.nota_tarde) ?? null,
      tiene: cob?.tiene[f] ?? 0,
      necesita: cob?.necesita[f] ?? 0,
    }
  }
  const ausentes: VistaDia['ausentes'] = []
  const orden = (e: Empleado) => e.orden * 1000 + 0

  for (const a of datos.asignaciones) {
    if (a.fecha !== fecha) continue
    const e = emp.get(a.empleado_id)
    if (!e) continue
    if (a.tipo !== 'T') {
      if (a.tipo !== 'L') ausentes.push({ emp: e, asig: a })
      continue
    }
    const segs = segmentos(a, tm)
    const custom = !a.turno || !!a.inicio
    segs.forEach((s, i) => {
      const f = franjaDeMinuto(s.ini % 1440)
      const horario = `${fmtHm(s.ini)}-${fmtHm(s.fin)}`
      const label = !custom && i === 0 ? a.turno! : `${Math.floor((s.ini % 1440) / 60)}-${Math.floor((s.fin % 1440) / 60)}`
      const lista = franjas[f].grupos
      let g = lista.find(x => x.label === label)
      if (!g) { g = { label, ini: s.ini % 1440, personas: [] }; lista.push(g) }
      g.personas.push({ emp: e, asig: a, horario })
      franjasCubiertas(s).forEach(otra => {
        if (otra !== f && !franjas[otra].apoyo.some(x => x.emp.id === e.id)) franjas[otra].apoyo.push({ emp: e, label })
      })
    })
  }
  for (const f of FRANJAS) {
    franjas[f].grupos.sort((a, b) => a.ini - b.ini || a.label.localeCompare(b.label))
    franjas[f].grupos.forEach(g => g.personas.sort((a, b) => orden(a.emp) - orden(b.emp) || a.emp.nombre.localeCompare(b.emp.nombre)))
  }
  for (const ev of datos.eventos) if (ev.fecha === fecha) franjas[franjaEvento(ev)].eventos.push(ev)
  for (const x of datos.extras) {
    if (x.fecha !== fecha) continue
    const ini = hm(x.inicio)
    if (ini != null) franjas[franjaDeMinuto(ini)].extras.push(x)
  }
  return { fecha, franjas, ausentes, faltanCodigos: cob?.faltanCodigos ?? [] }
}

export function horasExtra(x: Extra): number {
  const i = hm(x.inicio) ?? 0
  let f = hm(x.fin) ?? 0
  if (f <= i) f += 1440
  return ((f - i) / 60) * x.cantidad
}

export function horasEmpleadoRango(
  empId: string,
  fechas: string[],
  idx: Map<string, Map<string, Asignacion>>,
  tm: Map<string, Turno>,
  e?: Empleado,
): number {
  const m = idx.get(empId)
  if (!m) return 0
  return fechas.reduce((s, f) => {
    const a = m.get(f)
    return s + (a ? horasAsignacion(a, tm, e) : 0)
  }, 0)
}
