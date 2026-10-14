// Libro de cambios de planning: tipos y textos compartidos (cliente y servidor).
import { DIAS_LARGO, diaSemana, etiqueta, type Asignacion, type Turno } from './core'

/** Filas por hoja impresa (hueco suficiente para dos firmas por fila) */
export const FILAS_HOJA = 15
/** Cambios automáticos máximos en una misma fila (para que quepan en el papel) */
export const MAX_CAMBIOS_FILA = 4
/** Cambios del mismo colaborador dentro de este margen van a la misma fila */
export const MINUTOS_AGRUPAR = 20

export interface CambioLibro {
  fecha: string
  antes: string
  despues: string
  /** compañero con quien se intercambia el turno */
  con?: string
}

export interface EntradaLibro {
  id: string
  numero: number
  fecha_peticion: string
  empleado_id: string | null
  empleado_nombre: string
  detalle: string
  cambios: CambioLibro[]
  detalle_manual: boolean
  hoja: number | null
  impreso_at: string | null
  created_at: string
  updated_at: string
}

export interface HojaLibro {
  numero: number
  impreso_at: string
  firmada: boolean
  firmada_at: string | null
  filas: number
  desde: number | null
  hasta: number | null
}

const NOMBRE_AUSENCIA: Record<string, string> = { V: 'Vacaciones', BJ: 'Baja', FO: 'Formación', B: 'B (festivo)' }

/** Texto corto de lo que tiene alguien un día, tal como se escribe en el libro */
export function etiquetaLibro(a: Asignacion | null | undefined, tm: Map<string, Turno>): string {
  if (!a) return 'sin turno'
  if (a.tipo !== 'T' && a.tipo !== 'L') {
    const n = NOMBRE_AUSENCIA[a.tipo] ?? a.tipo
    return a.tipo === 'FO' && a.horas != null ? `${n} ${a.horas}h` : n
  }
  return etiqueta(a, tm) || 'sin turno'
}

export function fechaLibro(f: string): string {
  return `${DIAS_LARGO[diaSemana(f)].slice(0, 3)} ${f.slice(8)}/${f.slice(5, 7)}`
}

export function textoCambios(cambios: CambioLibro[]): string {
  return cambios
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(c => `${fechaLibro(c.fecha)}: ${c.antes} → ${c.despues}${c.con ? ` (cambio con ${c.con})` : ''}`)
    .join('\n')
}

/** Fecha de hoy en Madrid (YYYY-MM-DD), da igual dónde corra el servidor */
export function hoyMadrid(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return p
}
