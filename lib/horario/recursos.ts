import * as v from './validate'
import { MOTIVOS, type Franja } from './core'

// Recursos simples (alta/edición/borrado) del módulo Horario.
// Cada uno declara su tabla, su clave y cómo se valida una fila.

export interface Recurso {
  tabla: string
  clave: 'id' | 'fecha' | 'codigo' | 'clave' | 'mes'
  parse: (o: Record<string, unknown>) => Record<string, unknown>
  parseClave: (x: unknown) => string
  borrable: boolean
  /** en lugar de borrar, marcar como inactivo */
  borradoSuave?: boolean
}

const FRANJAS: readonly Franja[] = ['manana', 'mediodia', 'tarde']

export const RECURSOS: Record<string, Recurso> = {
  empleados: {
    tabla: 'hr_empleados',
    clave: 'id',
    parseClave: x => v.uuid(x),
    borrable: true,
    borradoSuave: true,
    parse: o => ({
      ...(o.id ? { id: v.uuid(o.id) } : {}),
      nombre: v.texto(o.nombre, 'nombre', 60),
      tipo: v.uno(o.tipo ?? 'plantilla', 'tipo', ['plantilla', 'extra'] as const),
      horas_contrato: v.numeroOpt(o.horas_contrato, 'horas_contrato', 0, 60),
      saldo_festivos_inicial: v.numeroOpt(o.saldo_festivos_inicial, 'saldo_festivos_inicial', -50, 50) ?? 0,
      orden: v.enteroOpt(o.orden, 'orden', 0, 9999) ?? 0,
      activo: o.activo === undefined ? true : v.bool(o.activo, 'activo'),
    }),
  },
  extras: {
    tabla: 'hr_extras',
    clave: 'id',
    parseClave: x => v.uuid(x),
    borrable: true,
    parse: o => ({
      ...(o.id ? { id: v.uuid(o.id) } : {}),
      fecha: v.fecha(o.fecha),
      cantidad: v.entero(o.cantidad, 'cantidad', 1, 50),
      inicio: v.hora(o.inicio, 'inicio'),
      fin: v.hora(o.fin, 'fin'),
      motivo: v.uno(o.motivo ?? 'refuerzo', 'motivo', MOTIVOS),
      origen: v.textoOpt(o.origen, 'origen', 40) ?? 'ETT',
      nota: v.textoOpt(o.nota, 'nota', 200),
    }),
  },
  eventos: {
    tabla: 'hr_eventos',
    clave: 'id',
    parseClave: x => v.uuid(x),
    borrable: true,
    parse: o => {
      const hora = v.horaOpt(o.hora, 'hora')
      const franja = v.unoOpt(o.franja, 'franja', FRANJAS)
      if (!hora && !franja) throw new v.ErrorValidacion('Indica la hora o la franja del evento')
      return {
        ...(o.id ? { id: v.uuid(o.id) } : {}),
        fecha: v.fecha(o.fecha),
        hora,
        franja,
        pax: v.enteroOpt(o.pax, 'pax', 0, 5000),
        tipo: v.textoOpt(o.tipo, 'tipo', 40),
        nombre: v.textoOpt(o.nombre, 'nombre', 80),
        nota: v.textoOpt(o.nota, 'nota', 200),
      }
    },
  },
  ciudad: {
    tabla: 'hr_eventos_ciudad',
    clave: 'id',
    parseClave: x => v.uuid(x),
    borrable: true,
    parse: o => ({
      ...(o.id ? { id: v.uuid(o.id) } : {}),
      fecha: v.fecha(o.fecha),
      hora: v.horaOpt(o.hora, 'hora'),
      categoria: v.uno(o.categoria ?? 'futbol', 'categoria', ['futbol', 'concierto', 'feria', 'otro'] as const),
      descripcion: v.texto(o.descripcion, 'descripcion', 80),
    }),
  },
  festivos: {
    tabla: 'hr_festivos',
    clave: 'fecha',
    parseClave: x => v.fecha(x),
    borrable: true,
    parse: o => ({
      fecha: v.fecha(o.fecha),
      nombre: v.texto(o.nombre, 'nombre', 60),
      ambito: v.uno(o.ambito ?? 'local', 'ambito', ['nacional', 'autonomico', 'local'] as const),
    }),
  },
  dias: {
    tabla: 'hr_dias',
    clave: 'fecha',
    parseClave: x => v.fecha(x),
    borrable: false,
    parse: o => {
      const out: Record<string, unknown> = { fecha: v.fecha(o.fecha) }
      // solo se tocan los campos que vienen
      if ('ocupacion_manual' in o) out.ocupacion_manual = v.enteroOpt(o.ocupacion_manual, 'ocupacion_manual', 0, 5000)
      if ('nota_manana' in o) out.nota_manana = v.textoOpt(o.nota_manana, 'nota_manana', 200)
      if ('nota_mediodia' in o) out.nota_mediodia = v.textoOpt(o.nota_mediodia, 'nota_mediodia', 200)
      if ('nota_tarde' in o) out.nota_tarde = v.textoOpt(o.nota_tarde, 'nota_tarde', 200)
      return out
    },
  },
  turnos: {
    tabla: 'hr_turnos',
    clave: 'codigo',
    parseClave: x => v.codigo(x),
    borrable: true,
    borradoSuave: true,
    parse: o => {
      const cod = v.codigo(typeof o.codigo === 'string' ? o.codigo.toUpperCase() : o.codigo)
      if (['L', 'V', 'BJ', 'FO', 'B'].includes(cod)) throw new v.ErrorValidacion('Ese código está reservado para ausencias')
      return {
        codigo: cod,
        inicio: v.hora(o.inicio, 'inicio'),
        fin: v.hora(o.fin, 'fin'),
        orden: v.enteroOpt(o.orden, 'orden', 0, 999) ?? 0,
        activo: o.activo === undefined ? true : v.bool(o.activo, 'activo'),
      }
    },
  },
  meses: {
    tabla: 'hr_meses',
    clave: 'mes',
    parseClave: x => {
      const f = v.fecha(x, 'mes')
      if (!f.endsWith('-01')) throw new v.ErrorValidacion('mes debe ser día 1')
      return f
    },
    borrable: true,
    parse: o => {
      const f = v.fecha(o.mes, 'mes')
      if (!f.endsWith('-01')) throw new v.ErrorValidacion('mes debe ser día 1')
      return { mes: f, publicado_at: new Date().toISOString() }
    },
  },
  config: {
    tabla: 'hr_config',
    clave: 'clave',
    parseClave: () => 'cobertura',
    borrable: false,
    parse: o => {
      const n = (x: unknown, c: string) => v.entero(x, c, 0, 30)
      const fr = (x: unknown, c: string) => {
        const r = v.objeto(x, c)
        return { manana: n(r.manana, `${c}.manana`), mediodia: n(r.mediodia, `${c}.mediodia`), tarde: n(r.tarde, `${c}.tarde`) }
      }
      if (!Array.isArray(o.codigos_obligatorios) || o.codigos_obligatorios.length > 12) {
        throw new v.ErrorValidacion('codigos_obligatorios no válido')
      }
      return {
        clave: 'cobertura',
        valor: {
          laborable: fr(o.laborable, 'laborable'),
          finde: fr(o.finde, 'finde'),
          finde_por_centena: v.bool(o.finde_por_centena, 'finde_por_centena'),
          festivo_como_finde: v.bool(o.festivo_como_finde, 'festivo_como_finde'),
          codigos_obligatorios: o.codigos_obligatorios.map(c => v.codigo(c, 'codigos_obligatorios')),
          min_libres_semana: v.entero(o.min_libres_semana, 'min_libres_semana', 0, 7),
        },
      }
    },
  },
}
