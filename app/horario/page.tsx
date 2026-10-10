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
  describir,
  diaSemana,
  esFinde,
  etiqueta,
  finDeMes,
  fmtH,
  iso,
  lunes,
  type Asignacion,
  type Empleado,
  type TipoAsig,
} from '@/lib/horario/core'
import { horasEmpleadoRango } from '@/lib/horario/vista'
import { useDatos, type AsigInput } from './_lib/useDatos'
import EditorCelda from './_components/EditorCelda'

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
  const [arrastre, setArrastre] = useState<Set<string>>(new Set())
  const pulsado = useRef(false)

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
      if (!confirm('¿Volver a borrador? Los cambios dejarán de registrarse como ajustes.')) return
      await borrarRecurso('meses', 'mes', mes).catch(() => {})
    } else {
      if (!confirm('Publicar el mes: a partir de ahora cada cambio queda en el historial de ajustes (hoja semanal). ¿Seguir?')) return
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
        <span className={`hr-pill ${publicado ? 'ok' : ''}`}>{publicado ? 'Publicado · cambios = ajustes' : 'Borrador'}</span>
        {guardando && <span className="hr-pill">Guardando…</span>}
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
              {pincel ? 'Haz clic o arrastra sobre las celdas para aplicar.' : 'Clic en una celda para editarla (horario libre, partido, nota…).'}
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
                      <th key={f} className={`hr-day ${fes ? 'fes' : esFinde(f) ? 'fin' : ''}`} title={fes?.nombre}>
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
                      <th key={f} style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 400 }}
                        title={o ? `${o.personas} personas${o.desayunos != null ? ` · ${o.desayunos} desayunos contratados` : ''}${o.fuente === 'manual' ? ' (manual)' : ''}` : 'Sin forecast'}>
                        {o ? `${o.personas}${o.fuente === 'manual' ? '*' : ''}` : '·'}
                      </th>
                    )
                  })}
                  <th className="hr-tot" />
                </tr>
                <tr>
                  <th className="hr-name" style={{ fontWeight: 400, fontSize: 11 }}>Eventos · ciudad</th>
                  {d.fechas.map(f => {
                    const ev = datos.eventos.filter(e => e.fecha === f)
                    const pax = ev.reduce((s, e) => s + (e.pax ?? 0), 0)
                    const ciu = datos.ciudad.filter(c => c.fecha === f)
                    const tip = [...ev.map(e => `${e.hora ?? ''} ${e.pax ?? ''} pax ${e.tipo ?? ''} ${e.nombre ?? ''}`.trim()), ...ciu.map(c => `${c.hora ?? ''} ${c.descripcion}`.trim())].join('\n')
                    return (
                      <th key={f} title={tip} style={{ fontSize: 10, fontWeight: 400, fontFamily: 'var(--mono)', color: '#2d4fd4' }}>
                        {pax ? pax : ev.length ? '●' : ''}{ciu.length ? <span style={{ color: '#8a5a00' }}>{ev.length ? ' ' : ''}⚽</span> : ''}
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
                      <td className="hr-name" title={e.nombre}>
                        {e.nombre}
                        <span className="hr-muted" style={{ marginLeft: 6, fontFamily: 'var(--mono)', fontSize: 10 }}>
                          {e.tipo === 'extra' ? 'extra' : e.horas_contrato != null ? `${fmtH(e.horas_contrato)}h` : ''}
                        </span>
                      </td>
                      {d.fechas.map(f => {
                        const a = d.idx.get(e.id)?.get(f)
                        const k = `${e.id}|${f}`
                        const pend = arrastre.has(k)
                        const color = colorAsignacion(a, d.tm)
                        const c = color ? COLORES[color] : null
                        return (
                          <td key={f}
                            className={`hr-cell ${avisosPorCelda.has(k) ? 'err' : ''}`}
                            style={{
                              background: pend ? '#1a1916' : c?.bg ?? (d.festivos.has(f) ? '#fff6f5' : undefined),
                              color: pend ? '#fff' : c?.fg,
                              position: 'relative',
                            }}
                            title={`${describir(a, d.tm)}${a?.nota ? ' · ' + a.nota : ''}`}
                            onMouseDown={ev => {
                              ev.preventDefault()
                              if (!pincel) { setEditando({ emp: e, fecha: f }); return }
                              pulsado.current = true
                              setArrastre(new Set([k]))
                            }}
                            onMouseEnter={() => { if (pulsado.current) setArrastre(s => new Set(s).add(k)) }}
                          >
                            {etiqueta(a, d.tm)}
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

export default function Page() {
  return <Suspense fallback={<div className="hr-page hr-muted">Cargando…</div>}><Mensual /></Suspense>
}
