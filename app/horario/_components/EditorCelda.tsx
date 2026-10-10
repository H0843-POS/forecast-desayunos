'use client'
import { useState } from 'react'
import {
  AUSENCIAS,
  COLORES,
  DIAS_LARGO,
  colorAsignacion,
  diaSemana,
  type Asignacion,
  type Empleado,
  type TipoAsig,
  type Turno,
} from '@/lib/horario/core'
import type { AsigInput } from '../_lib/useDatos'

interface Props {
  empleado: Empleado
  fecha: string
  actual?: Asignacion
  turnos: Turno[]
  tm: Map<string, Turno>
  onSave: (i: AsigInput) => Promise<void>
  onClose: () => void
}

export default function EditorCelda({ empleado, fecha, actual, turnos, tm, onSave, onClose }: Props) {
  const [tipo, setTipo] = useState<TipoAsig | null>(actual?.tipo ?? null)
  const [turno, setTurno] = useState<string | null>(actual?.turno ?? null)
  const [libre, setLibre] = useState(!!actual?.inicio)
  const [inicio, setInicio] = useState(actual?.inicio ?? '')
  const [fin, setFin] = useState(actual?.fin ?? '')
  const [partido, setPartido] = useState(!!actual?.inicio2)
  const [inicio2, setInicio2] = useState(actual?.inicio2 ?? '')
  const [fin2, setFin2] = useState(actual?.fin2 ?? '')
  const [horas, setHoras] = useState(actual?.horas != null ? String(actual.horas) : '')
  const [nota, setNota] = useState(actual?.nota ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const d = fecha.split('-')
  const titulo = `${empleado.nombre} · ${DIAS_LARGO[diaSemana(fecha)]} ${Number(d[2])}/${d[1]}`

  function elegirTurno(cod: string) {
    setTipo('T')
    setTurno(cod)
    setLibre(false)
  }

  async function guardar(borrar = false) {
    setError('')
    const input: AsigInput = borrar || !tipo
      ? { empleado_id: empleado.id, fecha, tipo: null }
      : {
          empleado_id: empleado.id, fecha, tipo,
          turno: tipo === 'T' ? turno : null,
          inicio: tipo === 'T' && libre ? inicio || null : null,
          fin: tipo === 'T' && libre ? fin || null : null,
          inicio2: tipo === 'T' && partido ? inicio2 || null : null,
          fin2: tipo === 'T' && partido ? fin2 || null : null,
          horas: tipo === 'FO' && horas ? Number(horas.replace(',', '.')) : null,
          nota: nota.trim() || null,
        }
    if (input.tipo === 'T' && !input.turno && !(input.inicio && input.fin)) {
      setError('Elige un turno o indica el horario')
      return
    }
    setGuardando(true)
    try {
      await onSave(input)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const activos = turnos.filter(t => t.activo)

  return (
    <div className="hr-modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="hr-modal" role="dialog" aria-label={titulo}>
        <header>
          <h3>{titulo}</h3>
          <button className="hr-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="hr-mbody">
          {error && <div className="hr-error" style={{ margin: 0 }}>{error}</div>}
          <div>
            <div className="hr-muted" style={{ marginBottom: 6 }}>Turno</div>
            <div className="hr-codes">
              {activos.map(t => {
                const c = COLORES[colorAsignacion({ tipo: 'T', turno: t.codigo } as Asignacion, tm) ?? 'blanco']
                return (
                  <button key={t.codigo} className={tipo === 'T' && turno === t.codigo ? 'on' : ''}
                    style={{ background: c.bg, color: c.fg }} onClick={() => elegirTurno(t.codigo)}
                    title={`${t.inicio}-${t.fin}`}>
                    {t.codigo}
                  </button>
                )
              })}
              <button className={tipo === 'T' && !turno ? 'on' : ''} onClick={() => { setTipo('T'); setTurno(null); setLibre(true) }}>
                Otro horario
              </button>
            </div>
          </div>
          <div>
            <div className="hr-muted" style={{ marginBottom: 6 }}>Ausencia</div>
            <div className="hr-codes">
              {AUSENCIAS.map(a => (
                <button key={a.tipo} className={tipo === a.tipo ? 'on' : ''} title={a.label}
                  style={{ background: a.tipo === 'L' ? '#fff' : COLORES.ausencia.bg }}
                  onClick={() => { setTipo(a.tipo); setTurno(null) }}>
                  {a.tipo}
                </button>
              ))}
            </div>
            <div className="hr-muted" style={{ marginTop: 4 }}>
              L libre · V vacaciones · BJ baja · FO formación · B festivo devuelto
            </div>
          </div>

          {tipo === 'T' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {turno && (
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={libre} onChange={e => setLibre(e.target.checked)} />
                  Cambiar la hora de {turno} solo este día
                </label>
              )}
              {libre && (
                <div className="hr-row">
                  <label className="hr-lab">Entrada<input className="hr-input" type="time" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
                  <label className="hr-lab">Salida<input className="hr-input" type="time" value={fin} onChange={e => setFin(e.target.value)} /></label>
                </div>
              )}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={partido} onChange={e => setPartido(e.target.checked)} />
                Turno partido (segundo tramo)
              </label>
              {partido && (
                <div className="hr-row">
                  <label className="hr-lab">Entrada 2<input className="hr-input" type="time" value={inicio2} onChange={e => setInicio2(e.target.value)} /></label>
                  <label className="hr-lab">Salida 2<input className="hr-input" type="time" value={fin2} onChange={e => setFin2(e.target.value)} /></label>
                </div>
              )}
            </div>
          )}
          {tipo === 'FO' && (
            <label className="hr-lab">
              Horas de formación (vacío = jornada de su contrato)
              <input className="hr-input" inputMode="decimal" value={horas} onChange={e => setHoras(e.target.value)} placeholder="p. ej. 4" />
            </label>
          )}
          <label className="hr-lab">
            Nota (opcional)
            <input className="hr-input" maxLength={200} value={nota} onChange={e => setNota(e.target.value)} />
          </label>
        </div>
        <footer>
          <button className="hr-btn peligro" onClick={() => guardar(true)} disabled={guardando || !actual}>Vaciar</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="hr-btn" onClick={onClose}>Cancelar</button>
            <button className="hr-btn pri" onClick={() => guardar()} disabled={guardando || !tipo}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
