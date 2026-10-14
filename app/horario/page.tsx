'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AUSENCIAS,
  COLORES,
  DIAS_CORTO,
  FRANJAS,
  FRANJA_LABEL,
  MESES,
  addDays,
  colorAsignacion,
  corto,
  describir,
  diaSemana,
  esFinde,
  etiqueta,
  parseEntrada,
  textoEntrada,
  finDeMes,
  fmtH,
  iso,
  lunes,
  type Asignacion,
  type Empleado,
  type TipoAsig,
  ICONO_CIUDAD,
} from '@/lib/horario/core'
import { horasEmpleadoRango } from '@/lib/horario/vista'
import { api } from '@/lib/horario/client'
import { FILAS_HOJA } from '@/lib/horario/libro'
import Link from 'next/link'
import { useDatos, type AsigInput } from './_lib/useDatos'
import EditorCelda from './_components/EditorCelda'
import EditorDia from './_components/EditorDia'
import { OcupacionInfo } from './_components/OcupacionInfo'
import { useTiempo } from './_lib/useTiempo'
import { describirTiempo, malaTerraza } from '@/lib/horario/tiempo'

type Pincel = null | { tipo: TipoAsig; turno?: string } | 'borrar'

function mesActual(): string {
  const d = new Date()
  return iso(new Date(d.getFullYear(), d.getMonth(), 1))
}

function Mensual() {
  const router = useRouter()
  const sp = useSearchParams()
  const qMes = sp.get('mes')
  const mes = qMes && /^\d{4}-\d{2}$/.test(qMes) ? `${qMes}-01` : mesActual()
  const fin = finDeMes(mes)
  const { datos, d, error, setError, cargando, guardando, guardarAsignaciones, guardarRecurso, borrarRecurso } =
    useDatos(mes, fin, addDays(lunes(mes), -7), addDays(lunes(fin), 13))

  const [pincel, setPincel] = useState<Pincel>(null)
  const [editando, setEditando] = useState<{ emp: Empleado; fecha: string } | null>(null)
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null)
  const { tiempo, cargando: cargandoTiempo, actualizar: actualizarTiempo } = useTiempo()
  const [arrastre, setArrastre] = useState<Set<string>>(new Set())
  const pulsado = useRef(false)
  // edición escribiendo en la celda
  const [celda, setCelda] = useState<{ emp: string; fecha: string; texto: string; error?: string } | null>(null)
  const confirmando = useRef(false)
  // arrastrar turnos
  const [sobre, setSobre] = useState<string | null>(null)
  // notas del empleado y libres debidos
  const [notasDe, setNotasDe] = useState<Empleado | null>(null)
  const [libres, setLibres] = useState<Map<string, { semana: number; faltan: number }[]>>(new Map())

  const irMes = (delta: number) => {
    const dt = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + delta, 1)
    router.push(`/horario?mes=${iso(dt).slice(0, 7)}`)
  }

  const publicado = !!datos?.meses_publicados.some(m => m.startsWith(mes.slice(0, 7)))

  const itemPincel = useCallback((empleado_id: string, fecha: string): AsigInput | null => {
    if (!pincel) return null
    if (pincel === 'borrar') return { empleado_id, fecha, tipo: null }
    return { empleado_id, fecha, tipo: pincel.tipo, turno: pincel.turno ?? null }
  }, [pincel])

  const soltar = useCallback(async () => {
    if (!pulsado.current) return
    pulsado.current = false
    const celdas = Array.from(arrastre)
    setArrastre(new Set())
    const items = celdas.map(k => { const [e, f] = k.split('|'); return itemPincel(e, f) }).filter(Boolean) as AsigInput[]
    if (items.length) await guardarAsignaciones(items).catch(() => {})
  }, [arrastre, itemPincel, guardarAsignaciones])

  useEffect(() => {
    const up = () => { soltar() }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [soltar])

  const anioMes = Number(mes.slice(0, 4))
  const cargarLibres = useCallback(async () => {
    try {
      const r = await api.get<{ empleados: { empleado_id: string; pendientes: { semana: number; faltan: number }[] }[] }>(`/api/horario/libres?anio=${anioMes}`)
      setLibres(new Map(r.empleados.map(x => [x.empleado_id, x.pendientes])))
    } catch { /* no bloquea el horario */ }
  }, [anioMes])
  useEffect(() => { if (datos) cargarLibres() }, [datos, cargarLibres])

  const abrirCelda = (emp: string, fecha: string) => {
    if (!d) return
    confirmando.current = false
    setCelda({ emp, fecha, texto: textoEntrada(d.idx.get(emp)?.get(fecha), d.tm) })
  }

  /** Guarda lo escrito y, si se pide, salta a otra celda */
  async function confirmarCelda(mover?: { dDia?: number; dEmp?: number }) {
    if (!celda || !d || confirmando.current) return
    let entrada
    try {
      entrada = parseEntrada(celda.texto, celda.fecha, d.tm)
    } catch (e) {
      setCelda({ ...celda, error: e instanceof Error ? e.message : 'No válido' })
      return
    }
    confirmando.current = true
    const actual = textoEntrada(d.idx.get(celda.emp)?.get(celda.fecha), d.tm)
    const cambiado = celda.texto.trim().toUpperCase() !== actual.toUpperCase()
    const siguiente = (() => {
      if (!mover) return null
      const iDia = d.fechas.indexOf(celda.fecha) + (mover.dDia ?? 0)
      const iEmp = d.visibles.findIndex(e => e.id === celda.emp) + (mover.dEmp ?? 0)
      if (iDia < 0 || iDia >= d.fechas.length || iEmp < 0 || iEmp >= d.visibles.length) return null
      return { emp: d.visibles[iEmp].id, fecha: d.fechas[iDia] }
    })()
    if (siguiente) abrirCelda(siguiente.emp, siguiente.fecha)
    else setCelda(null)
    if (cambiado) await guardarAsignaciones([{ empleado_id: celda.emp, fecha: celda.fecha, ...entrada }]).catch(() => {})
  }

  /** Soltar un turno arrastrado: mueve (o intercambia). Con Ctrl/Alt pulsado, copia. */
  async function soltarTurno(origen: string, destino: string, copiar: boolean) {
    if (!d || origen === destino) return
    const [eO, fO] = origen.split('|')
    const [eD, fD] = destino.split('|')
    const aO = d.idx.get(eO)?.get(fO)
    const aD = d.idx.get(eD)?.get(fD)
    if (!aO) return
    const copia = (a: Asignacion, emp: string, fecha: string): AsigInput => ({
      empleado_id: emp, fecha, tipo: a.tipo, turno: a.turno, inicio: a.inicio, fin: a.fin,
      inicio2: a.inicio2, fin2: a.fin2, horas: a.horas, nota: a.nota,
      // un libre movido sigue siendo de su semana original (así se ve que se le debe)
      libre_de: a.tipo === 'L' ? (a.libre_de ?? lunes(a.fecha)) : null,
    })
    const items: AsigInput[] = [copia(aO, eD, fD)]
    if (!copiar) items.push(aD ? copia(aD, eO, fO) : { empleado_id: eO, fecha: fO, tipo: null })
    await guardarAsignaciones(items).catch(() => {})
  }

  const avisosPorCelda = useMemo(() => {
    const s = new Set<string>()
    d?.avisos.filter(a => a.nivel === 'error' && a.texto.includes('descanso')).forEach(a => s.add(`${a.empleado_id}|${a.fecha}`))
    return s
  }, [d])

  async function pdf() {
    if (!datos || !d) return
    const { pdfMensual } = await import('@/lib/horario/pdf')
    await pdfMensual(mes, d.fechas, datos, d)
  }

  async function togglePublicar() {
    if (publicado) {
      if (!confirm('¿Volver a borrador? Los cambios de turno dejarán de apuntarse en el libro de cambios.')) return
      await borrarRecurso('meses', 'mes', mes).catch(() => {})
    } else {
      if (!confirm('Publicar el mes: a partir de ahora cada cambio de turno se apunta en el libro de cambios (para imprimir y firmar) y en los ajustes de la hoja semanal. ¿Seguir?')) return
      await guardarRecurso('meses', { mes }).catch(() => {})
    }
  }

  const [y, m] = [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))]
  const faltas = d ? d.fechas.filter(f => {
    if (!d.planificados.has(f)) return false
    const c = d.cob.get(f)
    return c && (FRANJAS.some(fr => c.tiene[fr] < c.necesita[fr]) || c.faltanCodigos.length)
  }) : []

  return (
    <div className="hr-page" onMouseLeave={() => { if (pulsado.current) soltar() }}>
      <div className="hr-bar">
        <button className="hr-btn" onClick={() => irMes(-1)} aria-label="Mes anterior">←</button>
        <h1>{MESES[m - 1]} {y}</h1>
        <button className="hr-btn" onClick={() => irMes(1)} aria-label="Mes siguiente">→</button>
        <span className={`hr-pill ${publicado ? 'ok' : ''}`}>{publicado ? 'Publicado · cambios al libro' : 'Borrador'}</span>
        {datos?.libro_pendientes ? (
          <Link href="/horario/libro" className={`hr-pill ${datos.libro_pendientes >= FILAS_HOJA ? 'mal' : 'warn'}`} style={{ textDecoration: 'none' }}>
            Libro: {datos.libro_pendientes} sin imprimir{datos.libro_pendientes >= FILAS_HOJA ? ' · hoja llena' : ''}
          </Link>
        ) : null}
        {guardando && <span className="hr-pill">Guardando…</span>}
        {datos && d && <OcupacionInfo fechas={d.fechas} ocupacion={datos.ocupacion} />}
        <div style={{ flex: 1 }} />
        <button className="hr-btn" onClick={togglePublicar} disabled={!datos}>{publicado ? 'Pasar a borrador' : 'Publicar mes'}</button>
        <button className="hr-btn pri" onClick={pdf} disabled={!datos}>PDF mensual</button>
      </div>

      {error && <div className="hr-error">{error} <button className="hr-link" onClick={() => setError('')}>cerrar</button></div>}

      {datos && d && (
        <>
          <div className="hr-paleta">
            <span className="hr-muted" style={{ marginRight: 4 }}>Pincel:</span>
            <button className={pincel === null ? 'on' : ''} onClick={() => setPincel(null)} title="Clic en una celda abre el editor">Editar</button>
            <span className="hr-sepv" />
            {datos.turnos.filter(t => t.activo).map(t => {
              const c = COLORES[colorAsignacion({ tipo: 'T', turno: t.codigo } as Asignacion, d.tm) ?? 'blanco']
              const on = pincel && pincel !== 'borrar' && pincel.tipo === 'T' && pincel.turno === t.codigo
              return (
                <button key={t.codigo} className={on ? 'on' : ''} style={{ background: c.bg, color: c.fg }}
                  title={`${t.inicio}-${t.fin}`} onClick={() => setPincel({ tipo: 'T', turno: t.codigo })}>{t.codigo}</button>
              )
            })}
            <span className="hr-sepv" />
            {AUSENCIAS.map(a => (
              <button key={a.tipo} title={a.label}
                className={pincel && pincel !== 'borrar' && pincel.tipo === a.tipo ? 'on' : ''}
                style={{ background: a.tipo === 'L' ? '#fff' : COLORES.ausencia.bg }}
                onClick={() => setPincel({ tipo: a.tipo })}>{a.tipo}</button>
            ))}
            <span className="hr-sepv" />
            <button className={pincel === 'borrar' ? 'on' : ''} onClick={() => setPincel('borrar')}>Vaciar</button>
            <span className="hr-muted" style={{ marginLeft: 8 }}>
              {pincel ? 'Haz clic o arrastra sobre las celdas para aplicar.' : 'Clic en una celda y escribe (M9, 9-17, L40…) · doble clic: editor completo · arrastra un turno para moverlo (Ctrl: copiar) · clic en el día: eventos y partidos.'}
            </span>
          </div>

          <div className="hr-grid-wrap" style={{ userSelect: 'none' }}>
            <table className="hr-grid">
              <thead>
                <tr>
                  <th className="hr-name">Empleado</th>
                  {d.fechas.map(f => {
                    const fes = d.festivos.get(f)
                    return (
                      <th key={f} className={`hr-day hr-clic ${fes ? 'fes' : esFinde(f) ? 'fin' : ''}`} title={`${fes ? fes.nombre + ' · ' : ''}Clic: eventos, partidos, ocupación y notas del día`}
                        onClick={() => setDiaAbierto(f)}>
                        <div className="hr-dnum">{Number(f.slice(8))}</div>
                        <div className="hr-dlet">{DIAS_CORTO[diaSemana(f)]}</div>
                      </th>
                    )
                  })}
                  <th className="hr-tot">h mes</th>
                </tr>
                <tr>
                  <th className="hr-name" style={{ fontWeight: 400, fontSize: 11 }}>Ocupación</th>
                  {d.fechas.map(f => {
                    const o = datos.ocupacion[f]
                    return (
                      <th key={f} className="hr-clic" style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 400 }} onClick={() => setDiaAbierto(f)}
                        title={o ? `${o.personas} personas${o.desayunos != null ? ` · ${o.desayunos} desayunos contratados` : ''}${o.fuente === 'manual' ? ' (manual)' : ''}` : 'Sin forecast'}>
                        {o ? `${o.personas}${o.fuente === 'manual' ? '*' : ''}` : '·'}
                      </th>
                    )
                  })}
                  <th className="hr-tot" />
                </tr>
                <tr>
                  <th className="hr-name" style={{ fontWeight: 400, fontSize: 11 }}>Eventos hotel (pax)</th>
                  {d.fechas.map(f => {
                    const ev = datos.eventos.filter(e => e.fecha === f)
                    const pax = ev.reduce((s, e) => s + (e.pax ?? 0), 0)
                    const tip = ev.map(e => [e.hora ? corto(e.hora) : '', e.pax != null ? `${e.pax} pax` : '', e.tipo, e.nombre].filter(Boolean).join(' · ')).join('\n')
                    return (
                      <th key={f} className="hr-clic" onClick={() => setDiaAbierto(f)} title={tip || 'Añadir evento'}
                        style={{ fontSize: 10, fontWeight: 500, fontFamily: 'var(--mono)', color: '#2d4fd4', background: ev.length ? '#eef3ff' : undefined }}>
                        {ev.length ? (pax || '●') : ''}
                      </th>
                    )
                  })}
                  <th className="hr-tot" />
                </tr>
                <tr>
                  <th className="hr-name" style={{ fontWeight: 400, fontSize: 11 }}>
                    Tiempo <button className="hr-link" style={{ fontSize: 10 }} onClick={actualizarTiempo} title="Actualizar previsión (Las Ventas)">{cargandoTiempo ? '…' : '↻'}</button>
                  </th>
                  {d.fechas.map(f => {
                    const t = tiempo.get(f)
                    const w = t ? describirTiempo(t.codigo) : null
                    return (
                      <th key={f} style={{ fontSize: 12, fontWeight: 400, background: t && malaTerraza(t) ? '#e8efff' : undefined }}
                        title={t ? `${w!.texto} · ${t.min != null ? Math.round(t.min) : '?'}/${t.max != null ? Math.round(t.max) : '?'}º${t.lluvia != null ? ` · lluvia ${t.lluvia}%` : ''}` : 'Sin previsión (solo 16 días)'}>
                        {w?.icono ?? ''}
                      </th>
                    )
                  })}
                  <th className="hr-tot" />
                </tr>
                <tr>
                  <th className="hr-name" style={{ fontWeight: 400, fontSize: 11 }}>Partidos · ciudad</th>
                  {d.fechas.map(f => {
                    const ciu = datos.ciudad.filter(c => c.fecha === f)
                    const madrid = ciu.some(c => c.en_madrid)
                    const tip = ciu.map(c => `${c.hora ? corto(c.hora) + ' ' : ''}${c.descripcion}${c.competicion ? ` (${c.competicion})` : ''}${c.en_madrid ? ' · en Madrid' : ''}`).join('\n')
                    return (
                      <th key={f} className="hr-clic" onClick={() => setDiaAbierto(f)} title={tip || 'Añadir partido o evento'}
                        style={{ fontSize: 11, fontWeight: 400, background: madrid ? '#fff3d6' : undefined }}>
                        {ciu.length ? Array.from(new Set(ciu.map(c => ICONO_CIUDAD[c.categoria]))).join('') : ''}
                      </th>
                    )
                  })}
                  <th className="hr-tot" />
                </tr>
              </thead>
              <tbody>
                {d.visibles.map((e, i) => {
                  const prev = d.visibles[i - 1]
                  return (
                    <tr key={e.id} className={prev && prev.tipo !== e.tipo ? 'sep-tipo' : ''}>
                      <td className="hr-name hr-clic" onClick={() => setNotasDe(e)}
                        title={`${e.nombre}${e.notas ? '\n\n' + e.notas : ''}\n\nClic: notas del empleado`}>
                        {e.nombre}
                        <span className="hr-muted" style={{ marginLeft: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {e.tipo === 'extra' ? 'extra' : e.horas_contrato != null ? `${fmtH(e.horas_contrato)}h` : ''}
                        </span>
                        {e.notas && <span style={{ marginLeft: 4 }} aria-label="Tiene notas">📝</span>}
                        {(libres.get(e.id)?.length ?? 0) > 0 && (
                          <span className="hr-pill warn" style={{ marginLeft: 4, padding: '0 5px', fontSize: 10 }}
                            title={'Libres que se le deben: ' + libres.get(e.id)!.map(p => `L${p.semana}${p.faltan > 1 ? ` ×${p.faltan}` : ''}`).join(', ')}>
                            −{libres.get(e.id)!.reduce((s, p) => s + p.faltan, 0)}L
                          </span>
                        )}
                      </td>
                      {d.fechas.map(f => {
                        const a = d.idx.get(e.id)?.get(f)
                        const k = `${e.id}|${f}`
                        const pend = arrastre.has(k)
                        const color = colorAsignacion(a, d.tm)
                        const c = color ? COLORES[color] : null
                        const editandoAqui = celda?.emp === e.id && celda.fecha === f
                        if (editandoAqui) {
                          return (
                            <td key={f} className="hr-cell" style={{ padding: 0, boxShadow: 'inset 0 0 0 2px #1a1916' }}
                              onDoubleClick={() => { confirmando.current = true; setCelda(null); setEditando({ emp: e, fecha: f }) }}>
                              <input
                                autoFocus
                                className="hr-cellin"
                                value={celda.texto}
                                title={celda.error ?? 'M9 · 9-17 · 10-14/20-24 · L · L40 · V · BJ · FO · B · vacío = borrar. Enter/Tab: guardar y siguiente día · Esc: cancelar'}
                                style={celda.error ? { background: '#fdecea', color: '#a3221b' } : undefined}
                                onChange={ev => setCelda({ ...celda, texto: ev.target.value, error: undefined })}
                                onFocus={ev => ev.target.select()}
                                onKeyDown={ev => {
                                  if (ev.key === 'Escape') { setCelda(null); return }
                                  if (ev.key === 'Enter' || (ev.key === 'Tab' && !ev.shiftKey) || ev.key === 'ArrowRight' && (ev.target as HTMLInputElement).selectionStart === celda.texto.length) { ev.preventDefault(); confirmarCelda({ dDia: 1 }) }
                                  else if (ev.key === 'Tab' && ev.shiftKey) { ev.preventDefault(); confirmarCelda({ dDia: -1 }) }
                                  else if (ev.key === 'ArrowDown') { ev.preventDefault(); confirmarCelda({ dEmp: 1 }) }
                                  else if (ev.key === 'ArrowUp') { ev.preventDefault(); confirmarCelda({ dEmp: -1 }) }
                                }}
                                onBlur={() => { if (!celda.error) confirmarCelda() }}
                              />
                            </td>
                          )
                        }
                        return (
                          <td key={f}
                            className={`hr-cell ${avisosPorCelda.has(k) ? 'err' : ''}`}
                            style={{
                              background: pend ? '#1a1916' : sobre === k ? '#c9d7ff' : c?.bg ?? (d.festivos.has(f) ? '#fff6f5' : undefined),
                              color: pend ? '#fff' : c?.fg,
                              position: 'relative',
                            }}
                            title={`${describir(a, d.tm)}${a?.nota ? ' · ' + a.nota : ''}${!pincel ? '\nClic: escribir · Doble clic: editor completo · Arrastra para mover (Ctrl = copiar)' : ''}`}
                            draggable={!pincel && !!a}
                            onDragStart={ev => { ev.dataTransfer.setData('text/plain', k); ev.dataTransfer.effectAllowed = 'copyMove' }}
                            onDragOver={ev => { if (!pincel) { ev.preventDefault(); ev.dataTransfer.dropEffect = ev.ctrlKey || ev.altKey || ev.metaKey ? 'copy' : 'move'; if (sobre !== k) setSobre(k) } }}
                            onDragLeave={() => setSobre(x => (x === k ? null : x))}
                            onDrop={ev => {
                              ev.preventDefault()
                              setSobre(null)
                              const origen = ev.dataTransfer.getData('text/plain')
                              if (/^[0-9a-f-]{36}\|\d{4}-\d{2}-\d{2}$/.test(origen)) soltarTurno(origen, k, ev.ctrlKey || ev.altKey || ev.metaKey)
                            }}
                            onDoubleClick={() => { if (!pincel) { setCelda(null); setEditando({ emp: e, fecha: f }) } }}
                            onMouseDown={ev => {
                              if (!pincel) return
                              ev.preventDefault()
                              pulsado.current = true
                              setArrastre(new Set([k]))
                            }}
                            onClick={() => { if (!pincel) abrirCelda(e.id, f) }}
                            onMouseEnter={() => { if (pulsado.current) setArrastre(s => new Set(s).add(k)) }}
                          >
                            {(() => { const t = etiqueta(a, d.tm); return t.length > 5 ? <span style={{ fontSize: 9, lineHeight: 1.05, display: 'block', wordBreak: 'break-all' }}>{t}</span> : t })()}
                            {a?.nota && <span style={{ position: 'absolute', top: 1, right: 2, width: 4, height: 4, borderRadius: 4, background: '#2d4fd4' }} />}
                          </td>
                        )
                      })}
                      <td className="hr-tot">{fmtH(horasEmpleadoRango(e.id, d.fechas, d.idx, d.tm, e))}</td>
                    </tr>
                  )
                })}
                {FRANJAS.map((fr, k) => (
                  <tr key={fr} className="hr-sum" style={k === 0 ? { borderTop: '2px solid var(--border-strong)' } : undefined}>
                    <td className="hr-name">{FRANJA_LABEL[fr]} (tiene/necesita)</td>
                    {d.fechas.map(f => {
                      const c = d.cob.get(f)!
                      if (!d.planificados.has(f)) return <td key={f} className="hr-muted" title="Sin planificar">—</td>
                      const falta = c.tiene[fr] < c.necesita[fr] || (fr === 'manana' && c.faltanCodigos.length > 0)
                      return (
                        <td key={f} className={falta ? 'falta' : 'cubre'}
                          title={fr === 'manana' && c.faltanCodigos.length ? `Sin cubrir: ${c.faltanCodigos.join(', ')}` : `Regla: ${c.regla}`}>
                          {c.tiene[fr]}/{c.necesita[fr]}
                        </td>
                      )
                    })}
                    <td className="hr-tot" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {d.visibles.length === 0 && (
            <div className="hr-card" style={{ marginTop: 12 }}>
              Todavía no hay empleados. Dalos de alta en <a href="/horario/plantilla">Plantilla</a>.
            </div>
          )}

          <div className="hr-avisos">
            {faltas.length > 0 && (
              <div className="hr-aviso error">
                Falta cobertura: {faltas.map(f => {
                  const c = d.cob.get(f)!
                  const partes = FRANJAS.filter(fr => c.tiene[fr] < c.necesita[fr]).map(fr => `${FRANJA_LABEL[fr].toLowerCase()} −${c.necesita[fr] - c.tiene[fr]}`)
                  if (c.faltanCodigos.length) partes.push(`sin ${c.faltanCodigos.join('/')}`)
                  return `${Number(f.slice(8))} (${partes.join(', ')})`
                }).join(' · ')}
              </div>
            )}
            {d.avisos.map((a, i) => <div key={i} className={`hr-aviso ${a.nivel}`}>{a.texto}</div>)}
            {d.visibles.filter(e => (libres.get(e.id)?.length ?? 0) > 0).map(e => (
              <div key={'l' + e.id} className="hr-aviso aviso">
                {e.nombre}: se le deben libres de {libres.get(e.id)!.map(p => `L${p.semana}${p.faltan > 1 ? ` (×${p.faltan})` : ''}`).join(', ')}. Para devolverlo escribe ese código en el día que se lo deis (p. ej. L{libres.get(e.id)![0].semana}).
              </div>
            ))}
            {!faltas.length && !d.avisos.length && d.visibles.length > 0 && (
              <div className="hr-aviso" style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>Sin avisos: cobertura completa y descansos correctos.</div>
            )}
          </div>
          <p className="hr-muted" style={{ marginTop: 10 }}>
            * ocupación introducida a mano. Las horas de contrato se comparan por semana (lunes–domingo); V, BJ y B descuentan la parte proporcional y FO cuenta como trabajada.
          </p>
        </>
      )}
      {cargando && !datos && <div className="hr-muted">Cargando…</div>}

      {notasDe && (
        <NotasEmpleado emp={notasDe} pendientes={libres.get(notasDe.id) ?? []} onClose={() => setNotasDe(null)}
          onSave={notas => guardarRecurso('empleados', {
            id: notasDe.id, nombre: notasDe.nombre, tipo: notasDe.tipo, horas_contrato: notasDe.horas_contrato,
            saldo_festivos_inicial: notasDe.saldo_festivos_inicial, orden: notasDe.orden, activo: notasDe.activo, notas,
          }).then(() => setNotasDe(null))} />
      )}
      {diaAbierto && datos && (
        <EditorDia fecha={diaAbierto} datos={datos} error={error} onClose={() => { setDiaAbierto(null); setError('') }}
          guardar={(r, b) => guardarRecurso(r, b)} borrar={(r, k, v) => borrarRecurso(r, k, v)} />
      )}
      {editando && datos && d && (
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

function NotasEmpleado({ emp, pendientes, onSave, onClose }: {
  emp: Empleado; pendientes: { semana: number; faltan: number }[]; onSave: (n: string | null) => Promise<unknown>; onClose: () => void
}) {
  const [t, setT] = useState(emp.notas ?? '')
  return (
    <div className="hr-modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="hr-modal" role="dialog">
        <header><h3>Notas · {emp.nombre}</h3><button className="hr-x" onClick={onClose} aria-label="Cerrar">✕</button></header>
        <div className="hr-mbody">
          {pendientes.length > 0 && (
            <div className="hr-aviso aviso">Libres que se le deben: {pendientes.map(p => `L${p.semana}${p.faltan > 1 ? ` ×${p.faltan}` : ''}`).join(', ')}</div>
          )}
          <textarea className="hr-input" rows={5} maxLength={500} value={t} onChange={e => setT(e.target.value)}
            placeholder="Le debemos un festivo, prefiere mañanas, cambio pactado con…" style={{ width: '100%', resize: 'vertical' }} autoFocus />
          <div className="hr-muted">{t.length}/500 · Solo se ve aquí y en Plantilla, no sale en los PDF.</div>
        </div>
        <footer>
          <span />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="hr-btn" onClick={onClose}>Cancelar</button>
            <button className="hr-btn pri" disabled={t === (emp.notas ?? '')} onClick={() => onSave(t.trim() || null).catch(() => {})}>Guardar</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<div className="hr-page hr-muted">Cargando…</div>}><Mensual /></Suspense>
}
