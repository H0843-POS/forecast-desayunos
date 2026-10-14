'use client'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/horario/client'
import { FILAS_HOJA, MINUTOS_AGRUPAR, hoyMadrid, type EntradaLibro, type HojaLibro } from '@/lib/horario/libro'

interface Libro {
  instalado: boolean
  pendientes: EntradaLibro[]
  hojas: HojaLibro[]
  empleados: { id: string; nombre: string }[]
}

const fFecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const fMomento = (iso: string) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })

function FilaPendiente({ e, guardar, quitar }: {
  e: EntradaLibro
  guardar: (e: EntradaLibro, cambios: { fecha_peticion: string; detalle: string }) => Promise<void>
  quitar: (e: EntradaLibro) => Promise<void>
}) {
  const [fecha, setFecha] = useState(e.fecha_peticion)
  const [detalle, setDetalle] = useState(e.detalle)
  useEffect(() => { setFecha(e.fecha_peticion); setDetalle(e.detalle) }, [e.fecha_peticion, e.detalle])
  const sucio = fecha !== e.fecha_peticion || detalle.trim() !== e.detalle
  const guardarSiCambia = () => { if (sucio && fecha && detalle.trim()) guardar(e, { fecha_peticion: fecha, detalle }) }
  return (
    <tr>
      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{e.numero}</td>
      <td><input className="hr-input" type="date" value={fecha} onChange={x => setFecha(x.target.value)} onBlur={guardarSiCambia} aria-label="Fecha de la petición" /></td>
      <td style={{ fontWeight: 500 }}>{e.empleado_nombre}</td>
      <td style={{ width: '48%' }}>
        <textarea className="hr-input hr-libro-det" value={detalle} maxLength={300} rows={Math.min(5, Math.max(2, detalle.split('\n').length))}
          onChange={x => setDetalle(x.target.value)} onBlur={guardarSiCambia} aria-label="Detalle del cambio" />
      </td>
      <td>
        <span className={`hr-pill ${e.detalle_manual ? '' : 'ok'}`} title={e.detalle_manual ? 'Escrito o retocado a mano' : 'Apuntado solo al cambiar el horario'}>
          {e.detalle_manual ? 'a mano' : 'auto'}
        </span>
      </td>
      <td><button className="hr-btn sm peligro" onClick={() => quitar(e)} aria-label={`Quitar fila ${e.numero}`}>✕</button></td>
    </tr>
  )
}

export default function LibroCambios() {
  const [libro, setLibro] = useState<Libro | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [nueva, setNueva] = useState<{ empleado_id: string; otro: string; fecha_peticion: string; detalle: string } | null>(null)
  const [hojaVista, setHojaVista] = useState<{ hoja: HojaLibro; filas: EntradaLibro[] } | null>(null)
  const [empHist, setEmpHist] = useState('')
  const [historial, setHistorial] = useState<EntradaLibro[] | null>(null)

  const cargar = useCallback(async () => {
    try { setLibro(await api.get<Libro>('/api/horario/libro')) } catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar') }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!empHist) { setHistorial(null); return }
    api.get<{ filas: EntradaLibro[] }>(`/api/horario/libro?empleado=${encodeURIComponent(empHist)}`)
      .then(r => setHistorial(r.filas)).catch(e => setError(e instanceof Error ? e.message : 'Error'))
  }, [empHist, libro])

  const pend = libro?.pendientes ?? []
  const sigHoja = (libro?.hojas[0]?.numero ?? 0) + 1
  const llenas = Math.floor(pend.length / FILAS_HOJA)
  const resto = pend.length % FILAS_HOJA
  const sinFirmar = useMemo(() => (libro?.hojas ?? []).filter(h => !h.firmada), [libro])

  async function guardar(e: EntradaLibro, c: { fecha_peticion: string; detalle: string }) {
    setError('')
    try {
      const r = await api.post<{ fila: EntradaLibro }>('/api/horario/libro', { id: e.id, ...c })
      setLibro(l => l && { ...l, pendientes: l.pendientes.map(x => (x.id === e.id ? r.fila : x)) })
    } catch (x) { setError(x instanceof Error ? x.message : 'Error al guardar'); cargar() }
  }

  async function quitar(e: EntradaLibro) {
    if (!confirm(`¿Quitar la fila ${e.numero} (${e.empleado_nombre}) del libro? El turno del horario no cambia.`)) return
    setError('')
    try { await api.del(`/api/horario/libro?id=${e.id}`); await cargar() } catch (x) { setError(x instanceof Error ? x.message : 'Error'); cargar() }
  }

  async function crear() {
    if (!nueva) return
    setError('')
    try {
      await api.post('/api/horario/libro', {
        fecha_peticion: nueva.fecha_peticion,
        detalle: nueva.detalle,
        ...(nueva.empleado_id === 'otro' ? { empleado_nombre: nueva.otro } : { empleado_id: nueva.empleado_id }),
      })
      setNueva(null)
      await cargar()
    } catch (x) { setError(x instanceof Error ? x.message : 'Error al guardar') }
  }

  async function imprimir(soloLlenas: boolean) {
    const n = soloLlenas ? llenas : llenas + (resto ? 1 : 0)
    const filas = soloLlenas ? llenas * FILAS_HOJA : pend.length
    const aviso = n === 1
      ? `Se cierra la hoja Nº ${sigHoja} con ${filas} fila${filas === 1 ? '' : 's'}${filas < FILAS_HOJA ? '; el hueco que sobra sale tachado' : ''}.`
      : `Se cierran las hojas Nº ${sigHoja} a ${sigHoja + n - 1} (${filas} filas).`
    if (!confirm(`${aviso}\nLo impreso ya no se puede tocar en la app. ¿Imprimir?`)) return
    setOcupado(true); setError(''); setMsg('')
    try {
      const r = await api.post<{ hojas: HojaLibro[]; filas: EntradaLibro[] }>('/api/horario/libro/imprimir', { solo_llenas: soloLlenas })
      const { pdfLibro } = await import('@/lib/horario/pdfLibro')
      await pdfLibro(r.hojas, r.filas, false)
      setMsg(`Impresa${r.hojas.length > 1 ? 's las hojas' : ' la hoja'} Nº ${r.hojas.map(h => h.numero).join(', ')}. Cuando estén firmadas, márcalas abajo.`)
      await cargar()
    } catch (x) { setError(x instanceof Error ? x.message : 'Error al imprimir'); cargar() } finally { setOcupado(false) }
  }

  async function reimprimir(h: HojaLibro) {
    setError('')
    try {
      const r = await api.get<{ hoja: HojaLibro; filas: EntradaLibro[] }>(`/api/horario/libro?hoja=${h.numero}`)
      const { pdfLibro } = await import('@/lib/horario/pdfLibro')
      await pdfLibro([r.hoja], r.filas, true)
    } catch (x) { setError(x instanceof Error ? x.message : 'Error') }
  }

  async function ver(h: HojaLibro) {
    if (hojaVista?.hoja.numero === h.numero) { setHojaVista(null); return }
    try { setHojaVista(await api.get(`/api/horario/libro?hoja=${h.numero}`)) } catch (x) { setError(x instanceof Error ? x.message : 'Error') }
  }

  async function firmar(h: HojaLibro, firmada: boolean) {
    setError('')
    setLibro(l => l && { ...l, hojas: l.hojas.map(x => (x.numero === h.numero ? { ...x, firmada } : x)) })
    try { await api.post('/api/horario/libro/hojas', { numero: h.numero, firmada }) } catch (x) { setError(x instanceof Error ? x.message : 'Error'); cargar() }
  }

  if (!libro) {
    return <div className="hr-page">{error ? <div className="hr-error">{error}</div> : <span className="hr-muted">Cargando…</span>}</div>
  }
  if (!libro.instalado) {
    return (
      <div className="hr-page">
        <div className="hr-bar"><h1>Libro de cambios de planning</h1></div>
        <div className="hr-error">Falta crear las tablas del libro: pega <b>supabase_horario_3.sql</b> en Supabase → SQL Editor → Run y recarga esta página.</div>
      </div>
    )
  }

  return (
    <div className="hr-page">
      <div className="hr-bar">
        <h1>Libro de cambios de planning</h1>
        <span className={`hr-pill ${pend.length >= FILAS_HOJA ? 'warn' : ''}`}>
          Hoja Nº {sigHoja} en curso · {Math.min(pend.length, FILAS_HOJA)}/{FILAS_HOJA} filas
        </span>
        {sinFirmar.length > 0 && <span className="hr-pill mal">{sinFirmar.length} hoja{sinFirmar.length === 1 ? '' : 's'} sin firmar</span>}
        <div style={{ flex: 1 }} />
        <button className="hr-btn" onClick={() => setNueva({ empleado_id: libro.empleados[0]?.id ?? 'otro', otro: '', fecha_peticion: hoyMadrid(), detalle: '' })}>+ Cambio a mano</button>
        {llenas > 0 && resto > 0 && (
          <button className="hr-btn" onClick={() => imprimir(true)} disabled={ocupado}>Imprimir solo hoja{llenas > 1 ? 's' : ''} llena{llenas > 1 ? 's' : ''} ({llenas})</button>
        )}
        <button className="hr-btn pri" onClick={() => imprimir(false)} disabled={ocupado || pend.length === 0}>
          {ocupado ? 'Imprimiendo…' : pend.length === 0 ? 'Nada que imprimir' : `Imprimir ${llenas + (resto ? 1 : 0) > 1 ? `${llenas + (resto ? 1 : 0)} hojas` : 'hoja'} (${pend.length} cambio${pend.length === 1 ? '' : 's'})`}
        </button>
      </div>

      {error && <div className="hr-error">{error} <button className="hr-link" onClick={() => setError('')}>cerrar</button></div>}
      {msg && <div className="hr-aviso aviso" style={{ marginBottom: 10 }}>{msg}</div>}
      {pend.length >= FILAS_HOJA && <div className="hr-aviso error" style={{ marginBottom: 10 }}>Hoja llena: imprímela y que firmen.</div>}

      <p className="hr-muted" style={{ fontSize: 12, marginBottom: 10 }}>
        En los meses publicados, cada cambio de turno se apunta aquí solo. Los cambios seguidos del mismo colaborador (en {MINUTOS_AGRUPAR} min) van en la misma fila,
        y un intercambio entre dos compañeros genera una fila para cada uno. Puedes retocar la fecha de la petición y el detalle hasta que se imprima.
      </p>

      {nueva && (
        <div className="hr-card" style={{ marginBottom: 14 }}>
          <h2>Nuevo cambio a mano</h2>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
            <label className="hr-field">Colaborador
              <select className="hr-select" value={nueva.empleado_id} onChange={e => setNueva({ ...nueva, empleado_id: e.target.value })}>
                {libro.empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                <option value="otro">Otro (escribir nombre)…</option>
              </select>
            </label>
            {nueva.empleado_id === 'otro' && (
              <label className="hr-field">Nombre
                <input className="hr-input" value={nueva.otro} maxLength={60} onChange={e => setNueva({ ...nueva, otro: e.target.value })} />
              </label>
            )}
            <label className="hr-field">Fecha de la petición
              <input className="hr-input" type="date" value={nueva.fecha_peticion} onChange={e => setNueva({ ...nueva, fecha_peticion: e.target.value })} />
            </label>
          </div>
          <label className="hr-field" style={{ marginTop: 8 }}>Detalle del cambio
            <textarea className="hr-input hr-libro-det" rows={3} maxLength={300} value={nueva.detalle} placeholder="Ej.: Jue 22/10: pide cambiar M8 por P14 por médico"
              onChange={e => setNueva({ ...nueva, detalle: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="hr-btn pri" onClick={crear}
              disabled={!nueva.detalle.trim() || !nueva.fecha_peticion || (nueva.empleado_id === 'otro' && !nueva.otro.trim())}>Añadir al libro</button>
            <button className="hr-btn" onClick={() => setNueva(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="hr-card" style={{ marginBottom: 14 }}>
        <h2>Pendientes de imprimir</h2>
        {pend.length === 0 ? <p className="hr-muted">No hay cambios pendientes. Se irán apuntando al cambiar turnos de un mes publicado.</p> : (
          <table className="hr-tabla">
            <thead><tr><th>Nº</th><th>Fecha petición</th><th>Colaborador</th><th>Detalle del cambio</th><th /><th /></tr></thead>
            <tbody>
              {pend.map((e, i) => (
                <Fragment key={e.id}>
                  {i > 0 && i % FILAS_HOJA === 0 && (
                    <tr><td colSpan={6} className="hr-muted" style={{ fontSize: 11, textAlign: 'center' }}>— aquí empieza la hoja Nº {sigHoja + i / FILAS_HOJA} —</td></tr>
                  )}
                  <FilaPendiente e={e} guardar={guardar} quitar={quitar} />
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="hr-cols">
        <div className="hr-card">
          <h2>Hojas impresas</h2>
          {libro.hojas.length === 0 ? <p className="hr-muted">Todavía no se ha impreso ninguna hoja.</p> : (
            <table className="hr-tabla">
              <thead><tr><th>Hoja</th><th>Impresa</th><th>Filas</th><th>Firmada</th><th /></tr></thead>
              <tbody>
                {libro.hojas.map(h => (
                  <tr key={h.numero} style={h.firmada ? undefined : { background: '#fffaf0' }}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>Nº {h.numero}</td>
                    <td className="hr-muted">{fMomento(h.impreso_at)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{h.filas}{h.desde != null ? ` · ${h.desde}–${h.hasta}` : ''}</td>
                    <td>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={h.firmada} onChange={e => firmar(h, e.target.checked)} />
                        {h.firmada ? 'Sí' : <span style={{ color: '#a3221b' }}>Pendiente</span>}
                      </label>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="hr-btn sm" onClick={() => ver(h)}>{hojaVista?.hoja.numero === h.numero ? 'Ocultar' : 'Ver'}</button>{' '}
                      <button className="hr-btn sm" onClick={() => reimprimir(h)}>Reimprimir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {hojaVista && (
            <div style={{ marginTop: 12 }}>
              <h2>Hoja Nº {hojaVista.hoja.numero}</h2>
              <TablaLectura filas={hojaVista.filas} />
            </div>
          )}
        </div>

        <div className="hr-card">
          <h2>Historial de un colaborador</h2>
          <select className="hr-select" value={empHist} onChange={e => setEmpHist(e.target.value)} style={{ marginBottom: 10 }}>
            <option value="">Elige colaborador…</option>
            {libro.empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          {historial && (historial.length === 0 ? <p className="hr-muted">Sin cambios en el libro.</p> : <TablaLectura filas={historial} conHoja />)}
        </div>
      </div>
    </div>
  )
}

function TablaLectura({ filas, conHoja }: { filas: EntradaLibro[]; conHoja?: boolean }) {
  return (
    <table className="hr-tabla">
      <thead><tr><th>Nº</th><th>Petición</th>{!conHoja && <th>Colaborador</th>}<th>Detalle</th>{conHoja && <th>Hoja</th>}</tr></thead>
      <tbody>
        {filas.map(e => (
          <tr key={e.id}>
            <td style={{ fontFamily: 'var(--mono)' }}>{e.numero}</td>
            <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{fFecha(e.fecha_peticion)}</td>
            {!conHoja && <td>{e.empleado_nombre}</td>}
            <td style={{ whiteSpace: 'pre-line' }}>{e.detalle}</td>
            {conHoja && <td>{e.hoja != null ? <span className="hr-pill">Nº {e.hoja}</span> : <span className="hr-pill warn">sin imprimir</span>}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
