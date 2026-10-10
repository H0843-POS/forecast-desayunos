'use client'
import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DIAS_CORTO,
  DIAS_LARGO,
  FRANJAS,
  FRANJA_LABEL,
  MESES,
  MOTIVOS,
  MOTIVO_LABEL,
  addDays,
  colorAsignacion,
  COLORES,
  corto,
  diaSemana,
  fmtH,
  franjaDeMinuto,
  hm,
  iso,
  lunes as lunesDe,
  type Empleado,
  type Franja,
} from '@/lib/horario/core'
import { horasExtra, vistaDia } from '@/lib/horario/vista'
import { useDatos, type AsigInput } from '../_lib/useDatos'
import EditorCelda from '../_components/EditorCelda'

type Abierto = null | { fecha: string; franja?: Franja; tipo: 'evento' | 'extra' | 'asignar' | 'ciudad' }

function Semana() {
  const router = useRouter()
  const sp = useSearchParams()
  const q = sp.get('d')
  const lunes = lunesDe(q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : iso(new Date()))
  const domingo = addDays(lunes, 6)
  const { datos, d, error, setError, cargando, guardando, guardarAsignaciones, guardarRecurso, borrarRecurso } =
    useDatos(lunes, domingo, addDays(lunes, -7), addDays(lunes, 13))
  const [editando, setEditando] = useState<{ emp: Empleado; fecha: string } | null>(null)
  const [abierto, setAbierto] = useState<Abierto>(null)

  const irSemana = (n: number) => router.push(`/horario/semana?d=${addDays(lunes, 7 * n)}`)
  const fmt = (f: string) => `${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1].toLowerCase()}`

  const vistas = useMemo(() => (datos && d ? d.fechas.map(f => vistaDia(f, datos, d.tm, d.cob.get(f))) : []), [datos, d])
  const ajustes = useMemo(() => (datos ? datos.ajustes.filter(a => a.fecha >= lunes && a.fecha <= domingo) : []), [datos, lunes, domingo])
  const resumenExtras = useMemo(() => {
    if (!datos) return { personas: 0, horas: 0, porMotivo: {} as Record<string, number> }
    const ex = datos.extras.filter(x => x.fecha >= lunes && x.fecha <= domingo)
    const porMotivo: Record<string, number> = {}
    ex.forEach(x => { porMotivo[x.motivo] = (porMotivo[x.motivo] ?? 0) + horasExtra(x) })
    return { personas: ex.reduce((s, x) => s + x.cantidad, 0), horas: ex.reduce((s, x) => s + horasExtra(x), 0), porMotivo }
  }, [datos, lunes, domingo])

  async function pdf() {
    if (!datos || !d) return
    const { pdfSemanal } = await import('@/lib/horario/pdf')
    await pdfSemanal(lunes, d.fechas, datos, d)
  }

  async function copiarSemanaAnterior() {
    if (!datos || !d) return
    const items: AsigInput[] = []
    for (const e of d.visibles.filter(x => x.activo)) {
      const m = d.idx.get(e.id)
      for (const f of d.fechas) {
        if (m?.get(f)) continue
        const prev = m?.get(addDays(f, -7))
        if (!prev) continue
        items.push({ ...prev, id: undefined, fecha: f })
      }
    }
    if (!items.length) { setError('No hay huecos que rellenar desde la semana anterior'); return }
    if (!confirm(`Se rellenarán ${items.length} celdas vacías copiando la semana anterior. Lo que ya está puesto no se toca. ¿Seguir?`)) return
    await guardarAsignaciones(items).catch(() => {})
  }

  async function guardarDia(fecha: string, campo: string, valor: string) {
    const v = valor.trim()
    await guardarRecurso('dias', { fecha, [campo]: campo === 'ocupacion_manual' ? (v === '' ? null : Number(v)) : v || null }).catch(() => {})
  }

  if (!datos || !d) {
    return <div className="hr-page">{error ? <div className="hr-error">{error}</div> : <span className="hr-muted">{cargando ? 'Cargando…' : ''}</span>}</div>
  }

  return (
    <div className="hr-page">
      <div className="hr-bar">
        <button className="hr-btn" onClick={() => irSemana(-1)} aria-label="Semana anterior">←</button>
        <h1>Semana {fmt(lunes)} – {fmt(domingo)}</h1>
        <button className="hr-btn" onClick={() => irSemana(1)} aria-label="Semana siguiente">→</button>
        {guardando && <span className="hr-pill">Guardando…</span>}
        <span className="hr-pill warn">Extras: {resumenExtras.personas} pers. · {fmtH(resumenExtras.horas)} h</span>
        <div style={{ flex: 1 }} />
        <button className="hr-btn" onClick={copiarSemanaAnterior}>Rellenar huecos con la semana anterior</button>
        <button className="hr-btn pri" onClick={pdf}>PDF semanal</button>
      </div>
      {error && <div className="hr-error">{error} <button className="hr-link" onClick={() => setError('')}>cerrar</button></div>}

      <div className="hr-week">
        {vistas.map(v => {
          const f = v.fecha
          const fes = d.festivos.get(f)
          const oc = datos.ocupacion[f]
          const dia = d.dias.get(f)
          const forecast = oc?.fuente === 'forecast' ? oc.personas : null
          const ciudad = datos.ciudad.filter(c => c.fecha === f)
          const libresDia = d.visibles.filter(e => {
            const a = d.idx.get(e.id)?.get(f)
            return e.activo && (!a || a.tipo === 'L')
          })
          return (
            <div key={f} className={`hr-wday ${fes ? 'fes' : ''}`}>
              <div className="hr-wleft" style={fes ? { background: '#fdecea' } : undefined}>
                <div className="dn" style={fes ? { color: '#a3221b' } : undefined}>{DIAS_LARGO[diaSemana(f)]}</div>
                <div className="dd">{Number(f.slice(8))}</div>
                {fes && <div style={{ fontSize: 11, color: '#a3221b' }}>{fes.nombre}</div>}
                <label className="hr-lab" style={{ marginTop: 4 }}>
                  Ocupación {oc?.fuente === 'manual' ? '(manual)' : ''}
                  <input
                    key={`${f}-${dia?.ocupacion_manual ?? ''}`}
                    className="hr-input" inputMode="numeric" style={{ width: 90, fontFamily: 'var(--mono)' }}
                    defaultValue={dia?.ocupacion_manual ?? ''}
                    placeholder={forecast != null ? String(forecast) : 'sin forecast'}
                    onBlur={e => { if (e.target.value !== String(dia?.ocupacion_manual ?? '')) guardarDia(f, 'ocupacion_manual', e.target.value) }}
                    title="Vacío = el dato del forecast"
                  />
                </label>
                {oc?.desayunos != null && <div className="hr-muted" style={{ fontFamily: 'var(--mono)' }}>Desay. contr. {oc.desayunos}</div>}
                {ciudad.map(c => (
                  <div key={c.id} className="hr-extra" style={{ background: '#eef3ff', color: '#2d4fd4' }}>
                    <span>{c.categoria === 'futbol' ? '⚽ ' : ''}{c.hora ? corto(c.hora) + ' ' : ''}{c.descripcion}</span>
                    <button className="hr-x" onClick={() => borrarRecurso('ciudad', 'id', c.id).catch(() => {})} aria-label="Quitar">✕</button>
                  </div>
                ))}
                {abierto?.fecha === f && abierto.tipo === 'ciudad'
                  ? <FormCiudad fecha={f} onCancel={() => setAbierto(null)} onSave={b => guardarRecurso('ciudad', b).then(() => setAbierto(null))} />
                  : <button className="hr-link" onClick={() => setAbierto({ fecha: f, tipo: 'ciudad' })}>+ evento ciudad</button>}
                {v.ausentes.length > 0 && (
                  <div className="hr-muted" style={{ marginTop: 4 }}>
                    {v.ausentes.map(a => (
                      <div key={a.emp.id}>
                        <button className="hr-link" onClick={() => setEditando({ emp: a.emp, fecha: f })}>{a.asig.tipo} · {a.emp.nombre}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {FRANJAS.map(fr => {
                const vf = v.franjas[fr]
                const planificado = d.planificados.has(f)
                const corta = planificado && vf.tiene < vf.necesita
                const notaCampo = fr === 'manana' ? 'nota_manana' : fr === 'mediodia' ? 'nota_mediodia' : 'nota_tarde'
                const turnosFranja = datos.turnos.filter(t => t.activo && franjaDeMinuto(hm(t.inicio) ?? 0) === fr)
                return (
                  <div key={fr} className="hr-wcol" style={corta ? { background: '#fffafa' } : undefined}>
                    <h4>
                      {FRANJA_LABEL[fr]}
                      {planificado
                        ? <span className={`hr-pill ${corta ? 'mal' : 'ok'}`}>{vf.tiene}/{vf.necesita}{corta ? ` · falta ${vf.necesita - vf.tiene}` : ''}</span>
                        : <span className="hr-pill">sin planificar · {vf.necesita}</span>}
                    </h4>
                    {fr === 'manana' && planificado && v.faltanCodigos.length > 0 && (
                      <div className="hr-pill mal" style={{ alignSelf: 'flex-start' }}>Sin cubrir: {v.faltanCodigos.join(', ')}</div>
                    )}
                    {vf.eventos.map(ev => (
                      <div key={ev.id} className="hr-evento">
                        <span><b>{ev.hora ? corto(ev.hora) : ''}</b> {ev.pax != null ? `${ev.pax} pax` : ''} {ev.tipo ?? ''} {ev.nombre ? `· ${ev.nombre}` : ''}</span>
                        <button className="hr-x" onClick={() => borrarRecurso('eventos', 'id', ev.id).catch(() => {})} aria-label="Quitar evento">✕</button>
                      </div>
                    ))}
                    <div className="hr-chips">
                      {vf.grupos.map(g => (
                        <div key={g.label} className="hr-chiprow">
                          <span className="cod">{g.label}</span>
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {g.personas.map(p => {
                              const c = COLORES[colorAsignacion(p.asig, d.tm) ?? 'blanco']
                              return (
                                <button key={p.emp.id + g.label} className="hr-chip" style={{ background: c.bg, color: c.fg }}
                                  title={`${p.horario}${p.asig.nota ? ' · ' + p.asig.nota : ''}`}
                                  onClick={() => setEditando({ emp: p.emp, fecha: f })}>
                                  {p.emp.nombre}{p.emp.tipo === 'extra' ? ' (ex)' : ''}
                                </button>
                              )
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                    {vf.apoyo.length > 0 && (
                      <div className="hr-muted" title="Cuentan en esta franja porque su turno la cubre">
                        También: {vf.apoyo.map(a => `${a.emp.nombre} (${a.label})`).join(', ')}
                      </div>
                    )}
                    {vf.extras.map(x => (
                      <div key={x.id} className="hr-extra">
                        <span><b>{x.cantidad} {x.origen}</b> {corto(x.inicio)}-{corto(x.fin)} · {MOTIVO_LABEL[x.motivo].toLowerCase()}{x.nota ? ` · ${x.nota}` : ''}</span>
                        <button className="hr-x" onClick={() => borrarRecurso('extras', 'id', x.id).catch(() => {})} aria-label="Quitar extra">✕</button>
                      </div>
                    ))}

                    {abierto?.fecha === f && abierto.franja === fr ? (
                      abierto.tipo === 'evento' ? (
                        <FormEvento fecha={f} franja={fr} onCancel={() => setAbierto(null)} onSave={b => guardarRecurso('eventos', b).then(() => setAbierto(null))} />
                      ) : abierto.tipo === 'extra' ? (
                        <FormExtra fecha={f} franja={fr} onCancel={() => setAbierto(null)} onSave={b => guardarRecurso('extras', b).then(() => setAbierto(null))} />
                      ) : (
                        <FormAsignar
                          libres={libresDia}
                          turnos={turnosFranja.map(t => t.codigo)}
                          onCancel={() => setAbierto(null)}
                          onOtro={emp => { setAbierto(null); setEditando({ emp, fecha: f }) }}
                          onSave={(emp, turno) => guardarAsignaciones([{ empleado_id: emp.id, fecha: f, tipo: 'T', turno }]).then(() => setAbierto(null))}
                        />
                      )
                    ) : (
                      <div className="hr-addline">
                        <button className="hr-link" onClick={() => setAbierto({ fecha: f, franja: fr, tipo: 'asignar' })}>+ persona</button>
                        <button className="hr-link" onClick={() => setAbierto({ fecha: f, franja: fr, tipo: 'extra' })}>+ extra</button>
                        <button className="hr-link" onClick={() => setAbierto({ fecha: f, franja: fr, tipo: 'evento' })}>+ evento</button>
                      </div>
                    )}
                    <textarea
                      key={`${f}-${fr}-${dia?.[notaCampo] ?? ''}`}
                      className="hr-nota" rows={1} maxLength={200} placeholder="Nota (p. ej. montar Bonobo)"
                      defaultValue={dia?.[notaCampo] ?? ''}
                      onBlur={e => { if (e.target.value.trim() !== (dia?.[notaCampo] ?? '')) guardarDia(f, notaCampo, e.target.value) }}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="hr-cols" style={{ marginTop: 14 }}>
        <div className="hr-card">
          <h2>Ajustes sobre el horario publicado</h2>
          {ajustes.length === 0 ? (
            <div className="hr-muted">
              {datos.meses_publicados.some(m => m.slice(0, 7) === lunes.slice(0, 7) || m.slice(0, 7) === domingo.slice(0, 7))
                ? 'Sin cambios esta semana.'
                : 'El mes está en borrador: los cambios se registran como ajustes cuando lo publiques.'}
            </div>
          ) : (
            <table className="hr-tabla">
              <thead><tr><th>Día</th><th>Empleado</th><th>Antes</th><th>Ahora</th><th>Cuándo</th></tr></thead>
              <tbody>
                {ajustes.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at)).map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'var(--mono)' }}>{DIAS_CORTO[diaSemana(a.fecha)]} {Number(a.fecha.slice(8))}</td>
                    <td>{a.empleado_nombre}</td>
                    <td className="hr-muted">{a.antes}</td>
                    <td>{a.despues}</td>
                    <td className="hr-muted">{new Date(a.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="hr-card">
          <h2>Extras de la semana</h2>
          <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            <div>{resumenExtras.personas} personas · <b>{fmtH(resumenExtras.horas)} h</b></div>
            {MOTIVOS.filter(m => resumenExtras.porMotivo[m]).map(m => (
              <div key={m} className="hr-muted">{MOTIVO_LABEL[m]}: {fmtH(resumenExtras.porMotivo[m])} h</div>
            ))}
          </div>
        </div>
      </div>

      {editando && (
        <EditorCelda
          empleado={editando.emp}
          fecha={editando.fecha}
          actual={d.idx.get(editando.emp.id)?.get(editando.fecha)}
          turnos={datos.turnos}
          tm={d.tm}
          onSave={i => guardarAsignaciones([i])}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- formularios

function FormEvento({ fecha, franja, onSave, onCancel }: { fecha: string; franja: Franja; onSave: (b: unknown) => Promise<unknown>; onCancel: () => void }) {
  const [hora, setHora] = useState('')
  const [pax, setPax] = useState('')
  const [tipo, setTipo] = useState('')
  const [nombre, setNombre] = useState('')
  return (
    <form className="hr-addline" onSubmit={e => { e.preventDefault(); onSave({ fecha, franja, hora: hora || null, pax: pax || null, tipo, nombre }).catch(() => {}) }}>
      <input className="hr-input" type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ width: 92 }} aria-label="Hora" />
      <input className="hr-input" inputMode="numeric" placeholder="pax" value={pax} onChange={e => setPax(e.target.value)} style={{ width: 56 }} />
      <input className="hr-input" list="hr-tipos-evento" placeholder="tipo" value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: 96 }} maxLength={40} />
      <input className="hr-input" placeholder="nombre / sala" value={nombre} onChange={e => setNombre(e.target.value)} style={{ width: 110 }} maxLength={80} />
      <datalist id="hr-tipos-evento">
        {['Coffee', 'Comida', 'Cena', 'Buffet', 'Finger', 'Cóctel', 'Barra libre', 'Comunión', 'Boda', 'Gala'].map(t => <option key={t} value={t} />)}
      </datalist>
      <button className="hr-btn sm pri">Añadir</button>
      <button type="button" className="hr-btn sm" onClick={onCancel}>✕</button>
    </form>
  )
}

const HORAS_DEFECTO: Record<Franja, [string, string]> = { manana: ['09:00', '13:00'], mediodia: ['13:00', '17:00'], tarde: ['18:00', '24:00'] }

function FormExtra({ fecha, franja, onSave, onCancel }: { fecha: string; franja: Franja; onSave: (b: unknown) => Promise<unknown>; onCancel: () => void }) {
  const [cantidad, setCantidad] = useState('1')
  const [inicio, setInicio] = useState(HORAS_DEFECTO[franja][0])
  const [fin, setFin] = useState(HORAS_DEFECTO[franja][1] === '24:00' ? '00:00' : HORAS_DEFECTO[franja][1])
  const [motivo, setMotivo] = useState<string>('refuerzo')
  const [origen, setOrigen] = useState('ETT')
  const [nota, setNota] = useState('')
  return (
    <form className="hr-addline" onSubmit={e => { e.preventDefault(); onSave({ fecha, cantidad, inicio, fin, motivo, origen, nota }).catch(() => {}) }}>
      <input className="hr-input" inputMode="numeric" value={cantidad} onChange={e => setCantidad(e.target.value)} style={{ width: 44 }} aria-label="Cantidad" />
      <input className="hr-input" value={origen} onChange={e => setOrigen(e.target.value)} style={{ width: 60 }} maxLength={40} aria-label="Origen" />
      <input className="hr-input" type="time" value={inicio} onChange={e => setInicio(e.target.value)} style={{ width: 92 }} aria-label="Entrada" />
      <input className="hr-input" type="time" value={fin} onChange={e => setFin(e.target.value)} style={{ width: 92 }} aria-label="Salida" />
      <select className="hr-select" value={motivo} onChange={e => setMotivo(e.target.value)} aria-label="Motivo">
        {MOTIVOS.map(m => <option key={m} value={m}>{MOTIVO_LABEL[m]}</option>)}
      </select>
      <input className="hr-input" placeholder="nota" value={nota} onChange={e => setNota(e.target.value)} style={{ width: 100 }} maxLength={200} />
      <button className="hr-btn sm pri">Añadir</button>
      <button type="button" className="hr-btn sm" onClick={onCancel}>✕</button>
    </form>
  )
}

function FormAsignar({ libres, turnos, onSave, onOtro, onCancel }: {
  libres: Empleado[]; turnos: string[]; onSave: (e: Empleado, turno: string) => Promise<unknown>; onOtro: (e: Empleado) => void; onCancel: () => void
}) {
  const [empId, setEmpId] = useState('')
  const [turno, setTurno] = useState(turnos[0] ?? '')
  const emp = libres.find(e => e.id === empId)
  if (!libres.length) return <div className="hr-muted">No queda nadie libre este día. <button className="hr-link" onClick={onCancel}>cerrar</button></div>
  return (
    <form className="hr-addline" onSubmit={e => { e.preventDefault(); if (emp && turno) onSave(emp, turno).catch(() => {}) }}>
      <select className="hr-select" value={empId} onChange={e => setEmpId(e.target.value)} aria-label="Empleado">
        <option value="">— libre —</option>
        {libres.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.tipo === 'extra' ? ' (extra)' : ''}</option>)}
      </select>
      <select className="hr-select" value={turno} onChange={e => setTurno(e.target.value)} aria-label="Turno">
        {turnos.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <button className="hr-btn sm pri" disabled={!emp || !turno}>Poner</button>
      <button type="button" className="hr-btn sm" disabled={!emp} onClick={() => emp && onOtro(emp)}>Otro horario…</button>
      <button type="button" className="hr-btn sm" onClick={onCancel}>✕</button>
    </form>
  )
}

function FormCiudad({ fecha, onSave, onCancel }: { fecha: string; onSave: (b: unknown) => Promise<unknown>; onCancel: () => void }) {
  const [hora, setHora] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('futbol')
  return (
    <form style={{ display: 'grid', gap: 4 }} onSubmit={e => { e.preventDefault(); onSave({ fecha, hora: hora || null, descripcion, categoria }).catch(() => {}) }}>
      <input className="hr-input" placeholder="Atleti - Madrid" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={80} autoFocus />
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="hr-input" type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ width: 90 }} aria-label="Hora" />
        <select className="hr-select" value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Tipo">
          <option value="futbol">Fútbol</option><option value="concierto">Concierto</option><option value="feria">Feria</option><option value="otro">Otro</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="hr-btn sm pri" disabled={!descripcion.trim()}>Añadir</button>
        <button type="button" className="hr-btn sm" onClick={onCancel}>✕</button>
      </div>
    </form>
  )
}

export default function Page() {
  return <Suspense fallback={<div className="hr-page hr-muted">Cargando…</div>}><Semana /></Suspense>
}
