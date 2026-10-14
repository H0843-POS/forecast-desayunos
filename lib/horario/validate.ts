// Validación estricta de todo lo que entra por la API del Horario.
// Cualquier campo que no pase se rechaza con 400; nada se pasa "tal cual".

export class ErrorValidacion extends Error {}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RE_CODIGO = /^[A-Z0-9]{1,5}$/

function fail(campo: string): never {
  throw new ErrorValidacion(`Campo no válido: ${campo}`)
}

export function fecha(v: unknown, campo = 'fecha'): string {
  if (typeof v !== 'string' || !RE_FECHA.test(v)) fail(campo)
  const d = new Date(v + 'T00:00:00Z')
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) fail(campo)
  const y = Number(v.slice(0, 4))
  if (y < 2020 || y > 2100) fail(campo)
  return v
}
export function hora(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !RE_HORA.test(v)) fail(campo)
  return v.slice(0, 5)
}
export function horaOpt(v: unknown, campo: string): string | null {
  if (v === null || v === undefined || v === '') return null
  return hora(v, campo)
}
export function uuid(v: unknown, campo = 'id'): string {
  if (typeof v !== 'string' || !RE_UUID.test(v)) fail(campo)
  return v.toLowerCase()
}
export function uuidOpt(v: unknown, campo = 'id'): string | null {
  if (v === null || v === undefined || v === '') return null
  return uuid(v, campo)
}
export function codigo(v: unknown, campo = 'codigo'): string {
  if (typeof v !== 'string' || !RE_CODIGO.test(v)) fail(campo)
  return v
}
export function texto(v: unknown, campo: string, max: number, min = 1): string {
  if (typeof v !== 'string') fail(campo)
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (t.length < min || t.length > max) fail(campo)
  return t
}
/** Como texto() pero conserva los saltos de línea (máx. `lineas`) */
export function textoLineas(v: unknown, campo: string, max: number, lineas: number): string {
  if (typeof v !== 'string') fail(campo)
  const t = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n')
  if (t.length < 1 || t.length > max || t.split('\n').length > lineas) fail(campo)
  return t
}
export function textoOpt(v: unknown, campo: string, max: number): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return texto(v, campo, max)
}
export function entero(v: unknown, campo: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) fail(campo)
  return n
}
export function enteroOpt(v: unknown, campo: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  return entero(v, campo, min, max)
}
export function numero(v: unknown, campo: string, min: number, max: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) fail(campo)
  return Math.round(n * 100) / 100
}
export function numeroOpt(v: unknown, campo: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null
  return numero(v, campo, min, max)
}
export function bool(v: unknown, campo: string): boolean {
  if (typeof v !== 'boolean') fail(campo)
  return v
}
export function uno<T extends string>(v: unknown, campo: string, opciones: readonly T[]): T {
  if (typeof v !== 'string' || !(opciones as readonly string[]).includes(v)) fail(campo)
  return v as T
}
export function unoOpt<T extends string>(v: unknown, campo: string, opciones: readonly T[]): T | null {
  if (v === null || v === undefined || v === '') return null
  return uno(v, campo, opciones)
}
export function objeto(v: unknown, campo = 'cuerpo'): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(campo)
  return v as Record<string, unknown>
}
