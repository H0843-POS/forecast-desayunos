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
  AZUL_COMIDAS,
  corto,
  diaSemana,
  fmtH,
  franjaDeMinuto,
  hm,
  iso,
  lunes as lunesDe,
  type Empleado,
  type Evento,
  type Extra,
  type Franja,
} from '@/lib/horario/core'
import { horasExtra, vistaDia } from '@/lib/horario/vista'
import { useDatos, type AsigInput } from '../_lib/useDatos'
import EditorCelda from '../_components/EditorCelda'
import EditorDia, { TIPOS_EVENTO } from '../_components/EditorDia'
import { OcupacionInfo } from '../_components/OcupacionInfo'

type Abierto = null | { fecha: string; franja?: Franja; tipo: 'extra' | 'asignar' | 'evento' }

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
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<string | null>(null)
  const [editOcup, setEditOcup] = useState<string | null>(null)

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
        items.push({ ...prev, id: undefined, fecha: f, libre_de: null })
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
        <OcupacionInfo fechas={d.fechas} ocupacion={datos.ocupacion} />
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
                <div style={{ marginTop: 4 }}>
                  <div className="hr-muted" style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Ocupación {oc?.fuente === 'manual' ? '· a mano' : oc ? '· forecast' : ''}
                  </div>
                  {editOcup === f ? (
                    <input
                      autoFocus className="hr-input" inputMode="numeric" style={{ width: 90, fontFamily: 'var(--mono)' }}
                      defaultValue={dia?.ocupacion_manual ?? oc?.personas ?? ''}
                      placeholder="vacío = forecast"
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditOcup(null) }}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        setEditOcup(null)
                        // si coincide con el forecast no hace falta guardarlo a mano
                        const nuevo = v === '' || (forecast != null && Number(v) === forecast) ? '' : v
                        if (nuevo !== String(dia?.ocupacion_manual ?? '')) guardarDia(f, 'ocupacion_manual', nuevo)
                      }}
                    />
                  ) : (
                    <button className="hr-clic" onClick={() => setEditOcup(f)} title="Cambiar a mano"
                      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 300, color: oc ? 'var(--text)' : 'var(--text-faint)', cursor: 'pointer' }}>
                      {oc ? oc.personas : '—'} <span style={{ fontSize: 11, opacity: 0.5 }}>✎</span>
                    </button>
                  )}
                  {oc?.fuente === 'manual' && (
                    <button className="hr-link" style={{ display: 'block' }} onClick={() => guardarDia(f, 'ocupacion_manual', '')}>volver al forecast</button>
                  )}
                </div>
                {oc?.desayunos != null && <div className="hr-muted" style={{ fontFamily: 'var(--mono)' }}>Desay. contr. {oc.desayunos}</div>}
                {ciudad.map(c => (
                  <button key={c.id} className="hr-extra hr-clic" style={{ background: '#eef3ff', color: '#2d4fd4', border: 0, textAlign: 'left', font: 'inherit', fontSize: 12 }}
                    onClick={() => setDiaAbierto(f)} title="Editar">
                    <span>{c.categoria === 'futbol' ? '⚽ ' : ''}{c.hora ? corto(c.hora) + ' ' : ''}{c.descripcion}{c.en_madrid && c.categoria === 'futbol' ? ' · en Madrid' : ''}</span>
                  </button>
                ))}
                <button className="hr-btn sm" onClick={() => setDiaAbierto(f)}>Eventos del día</button>
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
                    {vf.eventos.map(ev => editItem === ev.id ? (
                      <FormEvento key={ev.id} fecha={f} franja={fr} ev={ev} onCancel={() => setEditItem(null)}
                        onSave={b => guardarRecurso('eventos', b).then(() => setEditItem(null))}
                        onDelete={() => { if (confirm('¿Borrar este evento?')) borrarRecurso('eventos', 'id', ev.id).then(() => setEditItem(null)).catch(() => {}) }} />
                    ) : (
                      <button key={ev.id} className="hr-evento hr-clic" style={{ border: 0, textAlign: 'left', font: 'inherit', fontSize: 12 }}
                        onClick={() => setEditItem(ev.id)} title="Editar evento">
                        <span><b>{ev.hora ? corto(ev.hora) : ''}</b> {ev.pax != null ? `${ev.pax} pax` : ''} {ev.tipo ?? ''} {ev.nombre ? `· ${ev.nombre}` : ''}</span>
                        <span aria-hidden>✎</span>
                      </button>
                    ))}
                    <div className="hr-chips">
                      {vf.grupos.map(g => (
                        <div key={g.label} className="hr-chiprow">
                          <span className="cod">{g.label}</span>
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {g.personas.map(p => {
                              const col = colorAsignacion(p.asig, d.tm) ?? 'blanco'
                              const c = col === 'blanco' ? AZUL_COMIDAS : COLORES[col]
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
                      <div className="hr-chiprow" title="También cuentan en esta franja porque su turno la cubre">
                        <span className="cod">+</span>
                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {vf.apoyo.map(a => {
                            const c = fr === 'mediodia' ? AZUL_COMIDAS : fr === 'tarde' ? COLORES.verde : COLORES.rosa
                            return (
                              <button key={a.emp.id} className="hr-chip" style={{ background: c.bg, color: c.fg, borderStyle: 'dashed' }}
                                onClick={() => setEditando({ emp: a.emp, fecha: f })}>
                                {a.emp.nombre} <span style={{ opacity: 0.6, fontSize: 10 }}>{a.label}</span>
                              </button>
                            )
                          })}
                        </span>
                      </div>
                    )}
                    {vf.extras.map(x => editItem === x.id ? (
                      <FormExtra key={x.id} fecha={f} franja={fr} extra={x} onCancel={() => setEditItem(null)}
                        onSave={b => guardarRecurso('extras', b).then(() => setEditItem(null))}
                        onDelete={() => { if (confirm('¿Quitar este extra?')) borrarRecurso('extras', 'id', x.id).then(() => setEditItem(null)).catch(() => {}) }} />
                    ) : (
                      <button key={x.id} className="hr-extra hr-clic" style={{ border: 0, textAlign: 'left', font: 'inherit', fontSize: 12 }}
                        onClick={() => setEditItem(x.id)} title="Editar extra (nombre, horario, cantidad…)">
                        <span><b>{x.cantidad > 1 ? `${x.cantidad} ` : ''}{x.origen}</b> {corto(x.inicio)}-{corto(x.fin)} · {MOTIVO_LABEL[x.motivo].toLowerCase()}{x.nota ? ` · ${x.nota}` : ''}</span>
                        <span aria-hidden>✎</span>
                      </button>
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

      {diaAbierto && (
        <EditorDia fecha={diaAbierto} datos={datos} error={error} onClose={() => { setDiaAbierto(null); setError('') }}
          guardar={(r, b) => guardarRecurso(r, b)} borrar={(r, k, v) => borrarRecurso(r, k, v)} />
      )}
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

const HORAS_DEFECTO: Record<Franja, [string, string]> = { manana: ['09:00', '13:00'], mediodia: ['13:00', '17:00'], tarde: ['18:00', '24:00'] }

function FormExtra({ fecha, franja, extra, onSave, onCancel, onDelete }: {
  fecha: string; franja: Franja; extra?: Extra; onSave: (b: unknown) => Promise<unknown>; onCancel: () => void; onDelete?: () => void
}) {
  const [cantidad, setCantidad] = useState(String(extra?.cantidad ?? 1))
  const [inicio, setInicio] = useState(extra ? corto(extra.inicio) : HORAS_DEFECTO[franja][0])
  const [fin, setFin] = useState(extra ? corto(extra.fin) : HORAS_DEFECTO[franja][1] === '24:00' ? '00:00' : HORAS_DEFECTO[franja][1])
  const [motivo, setMotivo] = useState<string>(extra?.motivo ?? 'refuerzo')
  const [origen, setOrigen] = useState(extra?.origen ?? 'ETT')
  const [nota, setNota] = useState(extra?.nota ?? '')
  return (
    <form className="hr-form-in" onSubmit={e => { e.preventDefault(); onSave({ ...(extra ? { id: extra.id } : {}), fecha, cantidad, inicio, fin, motivo, origen, nota }).catch(() => {}) }}>
      <div className="hr-addline">
        <label className="hr-lab">Cuántos<input className="hr-input" inputMode="numeric" value={cantidad} onChange={e => setCantidad(e.target.value.replace(/\D/g, ''))} style={{ width: 52 }} /></label>
        <label className="hr-lab" style={{ flex: 1, minWidth: 110 }}>Nombre o ETT<input className="hr-input" value={origen} onChange={e => setOrigen(e.target.value)} maxLength={40} placeholder="ETT, Dani, Nacho…" /></label>
      </div>
      <div className="hr-addline">
        <label className="hr-lab">Entra<input className="hr-input" type="time" value={inicio} onChange={e => setInicio(e.target.value)} style={{ width: 96 }} /></label>
        <label className="hr-lab">Sale<input className="hr-input" type="time" value={fin} onChange={e => setFin(e.target.value)} style={{ width: 96 }} /></label>
        <label className="hr-lab">Motivo
          <select className="hr-select" value={motivo} onChange={e => setMotivo(e.target.value)}>
            {MOTIVOS.map(m => <option key={m} value={m}>{MOTIVO_LABEL[m]}</option>)}
          </select>
        </label>
      </div>
      <input className="hr-input" placeholder="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} maxLength={200} />
      <div className="hr-addline">
        <button className="hr-btn sm pri" disabled={!origen.trim() || !cantidad || !inicio || !fin}>{extra ? 'Guardar' : 'Añadir'}</button>
        <button type="button" className="hr-btn sm" onClick={onCancel}>Cancelar</button>
        {onDelete && <button type="button" className="hr-btn sm peligro" onClick={onDelete} style={{ marginLeft: 'auto' }}>Quitar</button>}
      </div>
    </form>
  )
}

function FormEvento({ fecha, franja, ev, onSave, onCancel, onDelete }: {
  fecha: string; franja: Franja; ev?: Evento; onSave: (b: unknown) => Promise<unknown>; onCancel: () => void; onDelete?: () => void
}) {
  const [hora, setHora] = useState(ev?.hora ? corto(ev.hora) : '')
  const [nombre, setNombre] = useState(ev?.nombre ?? '')
  const [pax, setPax] = useState(ev?.pax != null ? String(ev.pax) : '')
  const [tipo, setTipo] = useState(ev?.tipo ?? '')
  const [nota, setNota] = useState(ev?.nota ?? '')
  return (
    <form className="hr-form-in" style={{ background: '#eef3ff' }}
      onSubmit={e => { e.preventDefault(); onSave({ ...(ev ? { id: ev.id } : {}), fecha, hora: hora || null, franja: hora ? null : (ev?.franja ?? franja), nombre, pax: pax || null, tipo, nota }).catch(() => {}) }}>
      <div className="hr-addline">
        <label className="hr-lab">Hora<input className="hr-input" type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ width: 96 }} /></label>
        <label className="hr-lab">Pax<input className="hr-input" inputMode="numeric" value={pax} onChange={e => setPax(e.target.value.replace(/\D/g, ''))} style={{ width: 60 }} /></label>
        <label className="hr-lab" style={{ flex: 1, minWidth: 100 }}>Tipo<input className="hr-input" list="hr-tipos-evento" value={tipo} onChange={e => setTipo(e.target.value)} maxLength={40} /></label>
      </div>
      <label className="hr-lab">Empresa / cliente<input className="hr-input" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} autoFocus={!ev} /></label>
      <input className="hr-input" placeholder="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} maxLength={200} />
      <datalist id="hr-tipos-evento">{TIPOS_EVENTO.map(t => <option key={t} value={t} />)}</datalist>
      <div className="hr-addline">
        <button className="hr-btn sm pri" disabled={!hora && !nombre && !tipo && !pax}>{ev ? 'Guardar' : 'Añadir'}</button>
        <button type="button" className="hr-btn sm" onClick={onCancel}>Cancelar</button>
        {onDelete && <button type="button" className="hr-btn sm peligro" onClick={onDelete} style={{ marginLeft: 'auto' }}>Borrar</button>}
      </div>
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

export default function Page() {
  return <Suspense fallback={<div className="hr-page hr-muted">Cargando…</div>}><Semana /></Suspense>
}
