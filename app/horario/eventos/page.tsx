'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/horario/client'
import {
  DIAS_CORTO,
  FRANJA_LABEL,
  MESES,
  addDays,
  corto,
  diaSemana,
  finDeMes,
  franjaEvento,
  iso,
} from '@/lib/horario/core'
import { useDatos } from '../_lib/useDatos'
import EditorDia from '../_components/EditorDia'

interface EstadoSync { ultima: { at?: string; mensaje?: string } | null; configurado: boolean }

function mesActual(): string {
  const d = new Date()
  return iso(new Date(d.getFullYear(), d.getMonth(), 1))
}

function Eventos() {
  const router = useRouter()
  const sp = useSearchParams()
  const q = sp.get('mes')
  const mes = q && /^\d{4}-\d{2}$/.test(q) ? `${q}-01` : mesActual()
  const fin = finDeMes(mes)
  const { datos, error, setError, guardando, cargar, guardarRecurso, borrarRecurso } = useDatos(mes, fin, mes, fin)
  const [dia, setDia] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(mes)
  const [sync, setSync] = useState<EstadoSync | null>(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [msg, setMsg] = useState('')

  const leerSync = useCallback(async () => {
    try { setSync(await api.get<EstadoSync>('/api/horario/partidos')) } catch { /* nada */ }
  }, [])
  useEffect(() => { leerSync() }, [leerSync])
  useEffect(() => { setNuevo(mes) }, [mes])

  async function sincronizar() {
    setSincronizando(true); setMsg('')
    try {
      const r = await api.post<{ ok: boolean; mensaje: string; borrados: number }>('/api/horario/partidos', {})
      setMsg(r.ok ? `Actualizado: ${r.mensaje}${r.borrados ? ` · ${r.borrados} quitados (aplazados o cancelados)` : ''}` : r.mensaje)
      await Promise.all([cargar(), leerSync()])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al sincronizar')
    } finally { setSincronizando(false) }
  }

  const irMes = (n: number) => {
    const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1)
    router.push(`/horario/eventos?mes=${iso(d).slice(0, 7)}`)
  }

  const eventos = useMemo(() => (datos?.eventos ?? []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')), [datos])
  const ciudad = useMemo(() => (datos?.ciudad ?? []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')), [datos])
  const fmtDia = (f: string) => `${DIAS_CORTO[diaSemana(f)]} ${Number(f.slice(8))}`
  const m = Number(mes.slice(5, 7))
  const totalPax = eventos.reduce((s, e) => s + (e.pax ?? 0), 0)

  return (
    <div className="hr-page">
      <div className="hr-bar">
        <button className="hr-btn" onClick={() => irMes(-1)} aria-label="Mes anterior">←</button>
        <h1>Eventos y partidos · {MESES[m - 1]} {mes.slice(0, 4)}</h1>
        <button className="hr-btn" onClick={() => irMes(1)} aria-label="Mes siguiente">→</button>
        {guardando && <span className="hr-pill">Guardando…</span>}
      </div>
      {error && <div className="hr-error">{error} <button className="hr-link" onClick={() => setError('')}>cerrar</button></div>}

      <div className="hr-cols">
        <div className="hr-card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Eventos del hotel
            <span className="hr-pill">{eventos.length} eventos · {totalPax} pax</span>
          </h2>
          <div className="hr-addline" style={{ marginBottom: 10, alignItems: 'center' }}>
            <input className="hr-input" type="date" value={nuevo} min={mes} max={addDays(fin, 0)} onChange={e => setNuevo(e.target.value)} aria-label="Día" />
            <button className="hr-btn sm pri" disabled={!nuevo} onClick={() => setDia(nuevo)}>+ Añadir evento ese día</button>
          </div>
          {eventos.length === 0 ? <p className="hr-muted">No hay eventos este mes.</p> : (
            <table className="hr-tabla">
              <thead><tr><th>Día</th><th>Hora</th><th>Empresa</th><th>Pax</th><th>Tipo</th><th /></tr></thead>
              <tbody>
                {eventos.map(e => (
                  <tr key={e.id} className="hr-clic" onClick={() => setDia(e.fecha)}>
                    <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{fmtDia(e.fecha)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{e.hora ? corto(e.hora) : FRANJA_LABEL[franjaEvento(e)]}</td>
                    <td>{e.nombre ?? '—'}{e.nota ? <span className="hr-muted"> · {e.nota}</span> : null}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{e.pax ?? ''}</td>
                    <td>{e.tipo ?? ''}</td>
                    <td className="hr-muted">✎</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="hr-card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Partidos y ciudad
            <button className="hr-btn sm pri" onClick={sincronizar} disabled={sincronizando || sync?.configurado === false}>
              {sincronizando ? 'Actualizando…' : 'Actualizar partidos'}
            </button>
          </h2>
          <p className="hr-muted" style={{ marginBottom: 8 }}>
            {sync?.configurado === false
              ? 'Falta la clave de football-data.org (FOOTBALL_DATA_TOKEN) en Vercel para traer los partidos solos.'
              : <>Champions y LaLiga de Real Madrid, Atlético y Rayo, próximos 4 meses. Se actualiza solo cada mañana
                {sync?.ultima?.at ? ` · última vez ${new Date(sync.ultima.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}` : ''}.</>}
          </p>
          {msg && <div className="hr-aviso aviso" style={{ marginBottom: 8 }}>{msg}</div>}
          {ciudad.length === 0 ? <p className="hr-muted">Nada este mes.</p> : (
            <table className="hr-tabla">
              <thead><tr><th>Día</th><th>Hora</th><th>Partido / evento</th><th /></tr></thead>
              <tbody>
                {ciudad.map(c => (
                  <tr key={c.id} className="hr-clic" onClick={() => setDia(c.fecha)} style={c.en_madrid ? { background: '#fffaf0' } : undefined}>
                    <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{fmtDia(c.fecha)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{c.hora ? corto(c.hora) : <span className="hr-muted" title="Hora aún sin confirmar">¿?</span>}</td>
                    <td>
                      {c.categoria === 'futbol' ? '⚽ ' : ''}{c.descripcion}
                      {c.competicion && <span className="hr-pill" style={{ marginLeft: 6 }}>{c.competicion}</span>}
                      {c.en_madrid && <span className="hr-pill warn" style={{ marginLeft: 4 }}>en Madrid</span>}
                    </td>
                    <td className="hr-muted">✎</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="hr-muted" style={{ marginTop: 8 }}>Conciertos, ferias u otros partidos se añaden a mano desde el día (clic en cualquier fila o en el mensual).</p>
        </div>
      </div>

      {dia && datos && (
        <EditorDia fecha={dia} datos={datos} error={error} onClose={() => { setDia(null); setError('') }}
          guardar={(r, b) => guardarRecurso(r, b)} borrar={(r, k, v) => borrarRecurso(r, k, v)} />
      )}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<div className="hr-page hr-muted">Cargando…</div>}><Eventos /></Suspense>
}
