'use client'
import { useState } from 'react'
import {
  DIAS_LARGO,
  FRANJAS,
  FRANJA_LABEL,
  corto,
  diaSemana,
  type DatosHorario,
  type Evento,
  type EventoCiudad,
  type Franja,
} from '@/lib/horario/core'

// Todo lo de un día en un solo sitio: ocupación, eventos del hotel,
// partidos/eventos de la ciudad y notas por franja. Se abre desde el
// mensual, la hoja semanal y la página de eventos.

interface Props {
  fecha: string
  datos: DatosHorario
  guardar: (recurso: string, body: unknown) => Promise<unknown>
  borrar: (recurso: string, clave: string, valor: string) => Promise<unknown>
  onClose: () => void
  error?: string
}

export const TIPOS_EVENTO = ['Coffee break', 'Desayuno', 'Comida', 'Cena', 'Buffet', 'Finger', 'Cóctel', 'Barra libre', 'Comunión', 'Boda', 'Gala', 'Reunión']

export default function EditorDia({ fecha, datos, guardar, borrar, onClose, error }: Props) {
  const fes = datos.festivos.find(f => f.fecha === fecha)
  const oc = datos.ocupacion[fecha]
  const dia = datos.dias.find(d => d.fecha === fecha)
  const eventos = datos.eventos.filter(e => e.fecha === fecha).sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))
  const ciudad = datos.ciudad.filter(c => c.fecha === fecha)
  const d = fecha.split('-')

  return (
    <div className="hr-modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="hr-modal" style={{ maxWidth: 820 }} role="dialog">
        <header>
          <h3>
            {DIAS_LARGO[diaSemana(fecha)]} {Number(d[2])}/{d[1]}
            {fes && <span style={{ color: '#a3221b', fontWeight: 400, marginLeft: 8 }}>· {fes.nombre}</span>}
          </h3>
          <button className="hr-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="hr-mbody">
          {error && <div className="hr-error" style={{ margin: 0 }}>{error}</div>}
          <Ocupacion fecha={fecha} oc={oc} manual={dia?.ocupacion_manual ?? null} guardar={guardar} />

          <section>
            <h4 className="hr-sec">Eventos del hotel</h4>
            <table className="hr-tabla hr-tabla-ed">
              <thead><tr><th>Hora</th><th>Franja*</th><th>Empresa / cliente</th><th>Pax</th><th>Tipo</th><th>Nota</th><th /></tr></thead>
              <tbody>
                {eventos.map(ev => <FilaEvento key={ev.id + JSON.stringify(ev)} fecha={fecha} ev={ev} guardar={guardar} borrar={borrar} />)}
                <FilaEvento key={`nuevo-${eventos.length}`} fecha={fecha} guardar={guardar} borrar={borrar} />
              </tbody>
            </table>
            <datalist id="hr-tipos-evento">{TIPOS_EVENTO.map(t => <option key={t} value={t} />)}</datalist>
            <p className="hr-muted">* La franja solo hace falta si no pones hora.</p>
          </section>

          <section>
            <h4 className="hr-sec">Partidos y eventos de la ciudad</h4>
            <table className="hr-tabla hr-tabla-ed">
              <thead><tr><th>Hora</th><th>Partido / evento</th><th>Tipo</th><th>En Madrid</th><th /></tr></thead>
              <tbody>
                {ciudad.map(c => <FilaCiudad key={c.id + JSON.stringify(c)} fecha={fecha} c={c} guardar={guardar} borrar={borrar} />)}
                <FilaCiudad key={`nuevo-${ciudad.length}`} fecha={fecha} guardar={guardar} borrar={borrar} />
              </tbody>
            </table>
          </section>

          <Notas fecha={fecha} dia={dia} guardar={guardar} />
        </div>
        <footer><span /><button className="hr-btn pri" onClick={onClose}>Cerrar</button></footer>
      </div>
    </div>
  )
}

function Ocupacion({ fecha, oc, manual, guardar }: {
  fecha: string; oc: DatosHorario['ocupacion'][string] | undefined; manual: number | null; guardar: Props['guardar']
}) {
  const [v, setV] = useState(manual != null ? String(manual) : '')
  const forecast = oc?.fuente === 'forecast' ? oc : null
  return (
    <section className="hr-row" style={{ alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <h4 className="hr-sec" style={{ marginBottom: 2 }}>Ocupación</h4>
        <div className="hr-muted">
          {oc?.fuente === 'manual'
            ? `Puesta a mano: ${oc.personas}`
            : forecast
              ? `Del forecast: ${forecast.personas} personas${forecast.desayunos != null ? ` · ${forecast.desayunos} desayunos contratados` : ''}${forecast.cargado ? ` (subido el ${new Date(forecast.cargado).toLocaleDateString('es-ES')})` : ''}`
              : 'Sin forecast para este día. Súbelo en Previsión de ocupación o ponla a mano.'}
        </div>
      </div>
      <label className="hr-lab">
        A mano (vacío = forecast)
        <input className="hr-input" inputMode="numeric" style={{ width: 110 }} value={v} onChange={e => setV(e.target.value.replace(/\D/g, ''))} />
      </label>
      <button className="hr-btn sm pri" disabled={v === (manual != null ? String(manual) : '')}
        onClick={() => guardar('dias', { fecha, ocupacion_manual: v === '' ? null : Number(v) }).catch(() => {})}>Guardar</button>
    </section>
  )
}

function FilaEvento({ fecha, ev, guardar, borrar }: { fecha: string; ev?: Evento; guardar: Props['guardar']; borrar: Props['borrar'] }) {
  const ini = {
    hora: ev?.hora ? corto(ev.hora) : '',
    franja: (ev?.franja ?? '') as Franja | '',
    nombre: ev?.nombre ?? '',
    pax: ev?.pax != null ? String(ev.pax) : '',
    tipo: ev?.tipo ?? '',
    nota: ev?.nota ?? '',
  }
  const [f, setF] = useState(ini)
  const cambiado = JSON.stringify(f) !== JSON.stringify(ini)
  const vacio = !f.hora && !f.nombre && !f.pax && !f.tipo
  const set = (k: keyof typeof ini) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  async function ok() {
    await guardar('eventos', {
      ...(ev ? { id: ev.id } : {}),
      fecha, hora: f.hora || null, franja: f.hora ? null : f.franja || null,
      nombre: f.nombre, pax: f.pax || null, tipo: f.tipo, nota: f.nota,
    }).catch(() => {})
  }
  return (
    <tr>
      <td><input className="hr-input" type="time" value={f.hora} onChange={set('hora')} style={{ width: 96 }} aria-label="Hora" /></td>
      <td>
        <select className="hr-select" value={f.franja} onChange={set('franja')} disabled={!!f.hora} aria-label="Franja">
          <option value="">—</option>
          {FRANJAS.map(x => <option key={x} value={x}>{FRANJA_LABEL[x]}</option>)}
        </select>
      </td>
      <td><input className="hr-input" value={f.nombre} onChange={set('nombre')} maxLength={80} placeholder={ev ? '' : 'Nuevo evento…'} style={{ width: 150 }} /></td>
      <td><input className="hr-input" inputMode="numeric" value={f.pax} onChange={e => setF({ ...f, pax: e.target.value.replace(/\D/g, '') })} style={{ width: 58 }} aria-label="Pax" /></td>
      <td><input className="hr-input" list="hr-tipos-evento" value={f.tipo} onChange={set('tipo')} maxLength={40} style={{ width: 112 }} aria-label="Tipo" /></td>
      <td><input className="hr-input" value={f.nota} onChange={set('nota')} maxLength={200} style={{ width: 120 }} aria-label="Nota" /></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="hr-btn sm pri" disabled={!cambiado || vacio || (!f.hora && !f.franja)} onClick={ok}
          title={!f.hora && !f.franja ? 'Pon hora o franja' : undefined}>{ev ? 'Guardar' : 'Añadir'}</button>
        {ev && <button className="hr-x" style={{ marginLeft: 6 }} aria-label="Borrar evento"
          onClick={() => { if (confirm('¿Borrar este evento?')) borrar('eventos', 'id', ev.id).catch(() => {}) }}>✕</button>}
      </td>
    </tr>
  )
}

function FilaCiudad({ fecha, c, guardar, borrar }: { fecha: string; c?: EventoCiudad; guardar: Props['guardar']; borrar: Props['borrar'] }) {
  const ini = {
    hora: c?.hora ? corto(c.hora) : '',
    descripcion: c?.descripcion ?? '',
    categoria: c?.categoria ?? 'futbol',
    en_madrid: c?.en_madrid ?? true,
  }
  const [f, setF] = useState(ini)
  const cambiado = JSON.stringify(f) !== JSON.stringify(ini)
  return (
    <tr>
      <td><input className="hr-input" type="time" value={f.hora} onChange={e => setF({ ...f, hora: e.target.value })} style={{ width: 96 }} aria-label="Hora" /></td>
      <td>
        <input className="hr-input" value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} maxLength={120}
          placeholder={c ? '' : 'Atleti - Real Madrid…'} style={{ width: 220 }} />
        {c?.competicion && <span className="hr-pill" style={{ marginLeft: 6 }}>{c.competicion}</span>}
        {c?.external_id && <span className="hr-muted" style={{ marginLeft: 6 }} title="Se actualiza solo cada día">auto</span>}
      </td>
      <td>
        <select className="hr-select" value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value as EventoCiudad['categoria'] })} aria-label="Tipo">
          <option value="futbol">Fútbol</option><option value="concierto">Concierto</option><option value="feria">Feria</option><option value="otro">Otro</option>
        </select>
      </td>
      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={f.en_madrid} onChange={e => setF({ ...f, en_madrid: e.target.checked })} aria-label="En Madrid" /></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="hr-btn sm pri" disabled={!cambiado || !f.descripcion.trim()}
          onClick={() => guardar('ciudad', { ...(c ? { id: c.id } : {}), fecha, hora: f.hora || null, descripcion: f.descripcion, categoria: f.categoria, en_madrid: f.en_madrid, competicion: c?.competicion ?? null }).catch(() => {})}>
          {c ? 'Guardar' : 'Añadir'}
        </button>
        {c && <button className="hr-x" style={{ marginLeft: 6 }} aria-label="Borrar"
          onClick={() => { if (confirm('¿Quitar este evento?')) borrar('ciudad', 'id', c.id).catch(() => {}) }}>✕</button>}
      </td>
    </tr>
  )
}

function Notas({ fecha, dia, guardar }: { fecha: string; dia: DatosHorario['dias'][number] | undefined; guardar: Props['guardar'] }) {
  const ini = { nota_manana: dia?.nota_manana ?? '', nota_mediodia: dia?.nota_mediodia ?? '', nota_tarde: dia?.nota_tarde ?? '' }
  const [f, setF] = useState(ini)
  const campos: [keyof typeof ini, Franja][] = [['nota_manana', 'manana'], ['nota_mediodia', 'mediodia'], ['nota_tarde', 'tarde']]
  return (
    <section>
      <h4 className="hr-sec">Notas por franja (salen en la hoja semanal)</h4>
      <div className="hr-row">
        {campos.map(([k, fr]) => (
          <label key={k} className="hr-lab" style={{ flex: 1, minWidth: 180 }}>
            {FRANJA_LABEL[fr]}
            <input className="hr-input" value={f[k]} maxLength={200} onChange={e => setF({ ...f, [k]: e.target.value })} />
          </label>
        ))}
        <button className="hr-btn sm pri" disabled={JSON.stringify(f) === JSON.stringify(ini)}
          onClick={() => guardar('dias', { fecha, ...f }).catch(() => {})}>Guardar notas</button>
      </div>
    </section>
  )
}
