'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/horario/client'
import {
  DIAS_CORTO,
  FRANJAS,
  FRANJA_LABEL,
  addDays,
  corto,
  diaSemana,
  iso,
  type ConfigCobertura,
  type Festivo,
} from '@/lib/horario/core'
import { useDatos } from '../_lib/useDatos'

const hoy = iso(new Date())
const AMBITO: Record<Festivo['ambito'], string> = { nacional: 'Nacional', autonomico: 'Comunidad de Madrid', local: 'Madrid capital' }

export default function Calendario() {
  const { datos, error, setError, guardando, guardarRecurso, borrarRecurso } = useDatos(hoy, addDays(hoy, 74), hoy, addDays(hoy, 74))
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [festivos, setFestivos] = useState<Festivo[]>([])

  const cargarFestivos = useCallback(async () => {
    try { setFestivos(await api.get<Festivo[]>(`/api/horario/festivos?anio=${anio}`)) } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }, [anio, setError])
  useEffect(() => { cargarFestivos() }, [cargarFestivos])

  return (
    <div className="hr-page">
      <div className="hr-bar"><h1>Festivos, eventos de la ciudad y reglas</h1>{guardando && <span className="hr-pill">Guardando…</span>}</div>
      {error && <div className="hr-error">{error} <button className="hr-link" onClick={() => setError('')}>cerrar</button></div>}
      <div className="hr-cols">
        <div className="hr-card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Festivos
            <span style={{ display: 'flex', gap: 4 }}>
              <button className="hr-btn sm" onClick={() => setAnio(a => a - 1)}>←</button>
              <span className="hr-pill">{anio}</span>
              <button className="hr-btn sm" onClick={() => setAnio(a => a + 1)}>→</button>
            </span>
          </h2>
          {festivos.length === 0 && <p className="hr-muted">No hay festivos cargados para {anio}.</p>}
          <table className="hr-tabla">
            <tbody>
              {festivos.map(f => (
                <tr key={f.fecha}>
                  <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{DIAS_CORTO[diaSemana(f.fecha)]} {f.fecha.slice(8)}/{f.fecha.slice(5, 7)}</td>
                  <td>{f.nombre}</td>
                  <td className="hr-muted">{AMBITO[f.ambito]}</td>
                  <td><button className="hr-x" onClick={() => { if (confirm(`¿Quitar ${f.nombre}?`)) borrarRecurso('festivos', 'fecha', f.fecha).then(cargarFestivos).catch(() => {}) }} aria-label="Quitar">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <FormFestivo onSave={b => guardarRecurso('festivos', b).then(cargarFestivos)} />
          <p className="hr-muted" style={{ marginTop: 8 }}>
            2026 y los autonómicos de 2027 vienen cargados. Los dos locales de Madrid capital de 2027 se publican a final de año: añádelos aquí cuando salgan.
          </p>
        </div>

        <div className="hr-card">
          <h2>Eventos de la ciudad · próximas 10 semanas</h2>
          <p className="hr-muted" style={{ marginBottom: 8 }}>Partidos, conciertos, ferias… Salen en el horario mensual y en la hoja semanal.</p>
          <table className="hr-tabla">
            <tbody>
              {datos?.ciudad.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{DIAS_CORTO[diaSemana(c.fecha)]} {c.fecha.slice(8)}/{c.fecha.slice(5, 7)} {c.hora ? corto(c.hora) : ''}</td>
                  <td>{c.categoria === 'futbol' ? '⚽ ' : ''}{c.descripcion}</td>
                  <td><button className="hr-x" onClick={() => borrarRecurso('ciudad', 'id', c.id).catch(() => {})} aria-label="Quitar">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <FormCiudad onSave={b => guardarRecurso('ciudad', b)} />
        </div>

        {datos && <Reglas key={JSON.stringify(datos.config)} cfg={datos.config} codigos={datos.turnos.map(t => t.codigo)} onSave={b => guardarRecurso('config', b)} />}
      </div>
    </div>
  )
}

function FormFestivo({ onSave }: { onSave: (b: unknown) => Promise<unknown> }) {
  const [fecha, setFecha] = useState('')
  const [nombre, setNombre] = useState('')
  const [ambito, setAmbito] = useState('local')
  return (
    <form className="hr-addline" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); onSave({ fecha, nombre, ambito }).then(() => { setFecha(''); setNombre('') }).catch(() => {}) }}>
      <input className="hr-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} aria-label="Fecha" />
      <input className="hr-input" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} />
      <select className="hr-select" value={ambito} onChange={e => setAmbito(e.target.value)} aria-label="Ámbito">
        <option value="nacional">Nacional</option><option value="autonomico">Comunidad</option><option value="local">Local</option>
      </select>
      <button className="hr-btn sm pri" disabled={!fecha || !nombre.trim()}>Añadir</button>
    </form>
  )
}

function FormCiudad({ onSave }: { onSave: (b: unknown) => Promise<unknown> }) {
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('futbol')
  return (
    <form className="hr-addline" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); onSave({ fecha, hora: hora || null, descripcion, categoria }).then(() => { setDescripcion(''); setHora('') }).catch(() => {}) }}>
      <input className="hr-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} aria-label="Fecha" />
      <input className="hr-input" type="time" value={hora} onChange={e => setHora(e.target.value)} aria-label="Hora" />
      <input className="hr-input" placeholder="Atleti - Real Madrid" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={80} />
      <select className="hr-select" value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Tipo">
        <option value="futbol">Fútbol</option><option value="concierto">Concierto</option><option value="feria">Feria</option><option value="otro">Otro</option>
      </select>
      <button className="hr-btn sm pri" disabled={!fecha || !descripcion.trim()}>Añadir</button>
    </form>
  )
}

function Reglas({ cfg, codigos, onSave }: { cfg: ConfigCobertura; codigos: string[]; onSave: (b: unknown) => Promise<unknown> }) {
  const [c, setC] = useState<ConfigCobertura>(cfg)
  const num = (grupo: 'laborable' | 'finde', fr: (typeof FRANJAS)[number], val: string) =>
    setC(x => ({ ...x, [grupo]: { ...x[grupo], [fr]: Math.max(0, Math.min(30, Number(val) || 0)) } }))
  return (
    <div className="hr-card">
      <h2>Reglas de cobertura</h2>
      <table className="hr-tabla" style={{ marginBottom: 10 }}>
        <thead><tr><th>Mínimo de personas</th>{FRANJAS.map(f => <th key={f}>{FRANJA_LABEL[f]}</th>)}</tr></thead>
        <tbody>
          {(['laborable', 'finde'] as const).map(g => (
            <tr key={g}>
              <td>{g === 'laborable' ? 'Lunes a viernes' : 'Sábado y domingo'}</td>
              {FRANJAS.map(f => (
                <td key={f}><input className="hr-input" style={{ width: 52 }} inputMode="numeric" value={c[g][f]} onChange={e => num(g, f, e.target.value)} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        <label style={{ display: 'flex', gap: 6 }}>
          <input type="checkbox" checked={c.finde_por_centena} onChange={e => setC({ ...c, finde_por_centena: e.target.checked })} />
          Fin de semana: en mañanas, una persona por cada 100 de ocupación (600 → 6) si supera el mínimo
        </label>
        <label style={{ display: 'flex', gap: 6 }}>
          <input type="checkbox" checked={c.festivo_como_finde} onChange={e => setC({ ...c, festivo_como_finde: e.target.checked })} />
          Los festivos entre semana siguen la regla de fin de semana
        </label>
        <div>
          <div className="hr-muted" style={{ marginBottom: 4 }}>Turnos que siempre tienen que estar cubiertos (una persona por hora de desayuno):</div>
          <div className="hr-codes">
            {codigos.map(cod => {
              const on = c.codigos_obligatorios.includes(cod)
              return (
                <button key={cod} className={on ? 'on' : ''} style={{ background: on ? '#f8d7e3' : '#fff' }}
                  onClick={() => setC({ ...c, codigos_obligatorios: on ? c.codigos_obligatorios.filter(x => x !== cod) : [...c.codigos_obligatorios, cod] })}>
                  {cod}
                </button>
              )
            })}
          </div>
        </div>
        <label className="hr-lab" style={{ maxWidth: 260 }}>
          Mínimo de días libres por semana (según vuestro convenio)
          <input className="hr-input" style={{ width: 60 }} inputMode="numeric" value={c.min_libres_semana}
            onChange={e => setC({ ...c, min_libres_semana: Math.max(0, Math.min(7, Number(e.target.value) || 0)) })} />
        </label>
        <div><button className="hr-btn pri" onClick={() => onSave(c).catch(() => {})}>Guardar reglas</button></div>
      </div>
    </div>
  )
}
